import test, { expect, Locator, Page } from '@playwright/test'

type LiveUserType = 'rec' | 'med'

type ProductCandidate = {
	index: number
	isMedical: boolean
	key: string
	name: string
}

type MedicalCardUpdateResponse = {
	errors?: Record<string, string>
	message?: string
	outcome?: string
	successCloserize?: boolean
}

const productSelector = 'li.product.type-product'
const storefrontAddToCartSelector = [
	'button.fasd_to_cart[data-id][data-instance][data-facility][data-method]',
	'button.product_type_simple.fasd_to_cart.ajax_groove',
	'button.fasd_to_cart',
	'button.add_to_cart_button',
	'a.add_to_cart_button',
].join(', ')

const productPageAddToCartSelector = [
	'button.wpse-button-primary.fasd_to_cart',
	'button[aria-label="Add product to cart"]',
	'button.fasd_to_cart',
	'button:has-text("Add to Cart")',
	'button:has-text("Add to cart")',
].join(', ')

export class LiveNonProdCartFlow {
	readonly page: Page
	readonly cartButton: Locator
	readonly cartDrawer: Locator
	readonly checkoutButton: Locator
	readonly storefrontLinks: Locator
	readonly viewCartButton: Locator
	private storefrontUrl?: string

	constructor(page: Page) {
		this.page = page
		this.cartButton = page.locator('a.wpse-cart-openerize').first()
		this.cartDrawer = page.locator('#cartDrawer')
		this.checkoutButton = page.locator('a.checkout-button.button.alt.wc-forward').first()
		this.storefrontLinks = page.locator(
			[
				'.wpse-drawer[data-module="cart-response"] a[href*="/shop/"]',
				'#cartDrawer a[href*="/shop/"]',
				'a:has(h1.site-title)[href*="/shop/"]',
				'main nav a[href*="/shop/"]:has-text("All")',
			].join(', '),
		)
		this.viewCartButton = page
			.locator(
				[
					'#cartDrawer a.button.wpse-cart-openerize[href="/cart"][data-module="cart"]',
					'#cartDrawer a:has-text("View cart and checkout")',
					'#cartDrawer a:has-text("View Cart")',
					'.wpse-drawer[data-module="cart-response"] a[href="/cart"]:has-text("View Cart")',
				].join(', '),
			)
			.first()
	}

	async addProductsUntilCheckout(userType: LiveUserType) {
		await test.step(`Build an isolated Live ${userType.toUpperCase()} cart`, async () => {
			await this.clearTemporaryRegistrationCart(userType)
			await this.returnToStorefront()

			const attemptedProducts = new Set<string>()
			const rejectionReasons: string[] = []
			let medicalProductAdded = false

			for (let attempt = 1; attempt <= 24; attempt += 1) {
				const candidate = await this.findNextCandidate(
					userType,
					attemptedProducts,
					medicalProductAdded,
				)

				if (!candidate) {
					throw new Error(
						[
							`No additional ${userType} products were available after ${attempt - 1} attempt(s).`,
							...rejectionReasons.slice(-5),
						].join('\n'),
					)
				}

				attemptedProducts.add(candidate.key)
				const result = await this.addCandidate(candidate)

				if (!result.added) {
					rejectionReasons.push(`${candidate.name}: ${result.reason}`)
					await this.returnToStorefront()
					continue
				}

				medicalProductAdded ||= candidate.isMedical

				if (await this.minimumOrderIsNotMet()) {
					await this.closeCartDrawer()
					await this.returnToStorefront()
					continue
				}

				await this.openCartPageFromDrawer()

				if (userType === 'med') {
					await this.provideMedicalCardIfRequired()
				}

				if (
					(await this.checkoutButton.isVisible().catch(() => false)) &&
					(await this.checkoutButton.isEnabled().catch(() => false))
				) {
					await expect(this.checkoutButton).toBeVisible()
					await this.checkoutButton.evaluate((element: HTMLAnchorElement) => element.click())
					return
				}

				const addMoreItems = this.page.getByRole('link', { name: /add more items/i }).first()

				if (await addMoreItems.isVisible().catch(() => false)) {
					await addMoreItems.click()
					await this.waitForProducts()
					continue
				}

				throw new Error(
					`Checkout remained disabled after adding "${candidate.name}". Current URL: ${this.page.url()}`,
				)
			}

			throw new Error(
				[
					'Unable to build a checkout-ready Live cart after 24 bounded attempts.',
					...rejectionReasons.slice(-5),
				].join('\n'),
			)
		})
	}

	private async waitForProducts() {
		await this.page.locator(productSelector).first().waitFor({ state: 'visible', timeout: 15000 })
		await this.page.waitForLoadState('networkidle').catch(() => {})
	}

	private async returnToStorefront() {
		const currentUrl = new URL(this.page.url())
		const storefrontPath = currentUrl.pathname.match(/^\/shop\/[^/]+/)
		const productsAreVisible = await this.page
			.locator(productSelector)
			.first()
			.isVisible()
			.catch(() => false)

		if (storefrontPath && productsAreVisible) {
			this.storefrontUrl = new URL(`${storefrontPath[0]}/`, currentUrl).href
			return
		}

		const linkedStorefrontUrl = await this.storefrontLinks
			.evaluateAll(links =>
				links
					.map(link => (link as HTMLAnchorElement).href)
					.find(href => new URL(href).pathname.startsWith('/shop/')),
			)
			.catch(() => undefined)
		const storefrontUrl = this.storefrontUrl || linkedStorefrontUrl

		if (!storefrontUrl) {
			throw new Error(`Unable to identify the selected Live storefront from ${this.page.url()}`)
		}

		this.storefrontUrl = storefrontUrl
		await this.page.goto(storefrontUrl, { waitUntil: 'domcontentloaded' })

		await this.waitForProducts()
	}

	private parseCartItemCount(values: Array<string | null | undefined>) {
		for (const value of values) {
			if (!value) {
				continue
			}

			const normalizedValue = value.replace(/\s+/g, ' ').trim()
			const countMatch =
				normalizedValue.match(/\((\d+)\)/) ||
				normalizedValue.match(/\b(?:cart|bag)\D{0,12}(\d+)\b/i) ||
				normalizedValue.match(/^(\d+)\s*(?:items?)?$/i)

			if (countMatch) {
				return Number.parseInt(countMatch[1], 10)
			}
		}

		return null
	}

	private async cartItemCount() {
		const cartToggles = this.page.locator('a.wpse-cart-openerize')
		const cartToggleCount = await cartToggles.count()

		for (let index = 0; index < cartToggleCount; index += 1) {
			const values = await cartToggles
				.nth(index)
				.evaluate(element => [
					element.textContent,
					element.getAttribute('aria-label'),
					element.getAttribute('title'),
					element.getAttribute('data-count'),
					element.getAttribute('data-cart-count'),
					element.getAttribute('data-item-count'),
				])
				.catch(() => [])
			const parsedCount = this.parseCartItemCount(values)

			if (parsedCount !== null) {
				return parsedCount
			}
		}

		return this.cartDrawer
			.locator('tr.woocommerce-cart-form__cart-item, .cart_item')
			.count()
	}

	private async elementIntersectsViewport(locator: Locator) {
		if ((await locator.count()) === 0) {
			return false
		}

		return locator
			.evaluate(element => {
				const rect = element.getBoundingClientRect()
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					rect.left < window.innerWidth &&
					rect.right > 0 &&
					rect.top < window.innerHeight &&
					rect.bottom > 0
				)
			})
			.catch(() => false)
	}

	private async cartDrawerIsOpen() {
		return this.elementIntersectsViewport(
			this.page.locator('.wpse-drawer[data-module="cart"]'),
		)
	}

	private async waitForViewportIntersection(
		locator: Locator,
		intersectsViewport: boolean,
		timeout = 10000,
	) {
		const deadline = Date.now() + timeout

		while (Date.now() < deadline) {
			if ((await this.elementIntersectsViewport(locator)) === intersectsViewport) {
				return true
			}

			await this.page.waitForTimeout(100)
		}

		return (await this.elementIntersectsViewport(locator)) === intersectsViewport
	}

	private async waitForCartDrawerState(isOpen: boolean, timeout = 10000) {
		return this.waitForViewportIntersection(
			this.page.locator('.wpse-drawer[data-module="cart"]'),
			isOpen,
			timeout,
		)
	}

	private async clickActiveCartToggle() {
		const cartToggles = this.page.locator('a.wpse-cart-openerize')
		const cartToggleCount = await cartToggles.count()

		for (let index = 0; index < cartToggleCount; index += 1) {
			const cartToggle = cartToggles.nth(index)

			if (await this.elementIntersectsViewport(cartToggle)) {
				await cartToggle.evaluate((element: HTMLElement) => element.click())
				return true
			}
		}

		return false
	}

	private isLiveDev() {
		try {
			return new URL(this.page.url()).hostname.toLowerCase() === 'live-dev.710labs.com'
		} catch {
			return false
		}
	}

	private async openCartDrawer() {
		if (await this.cartDrawerIsOpen()) {
			return true
		}

		if (!(await this.clickActiveCartToggle())) {
			return false
		}

		return this.waitForCartDrawerState(true)
	}

	private async closeCartDrawer() {
		if (!(await this.cartDrawerIsOpen())) {
			return
		}

		const cartDrawerContainer = this.page.locator('.wpse-drawer[data-module="cart"]')
		const drawerCloseButton = cartDrawerContainer
			.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
			.first()

		if ((await drawerCloseButton.count()) > 0) {
			await drawerCloseButton.evaluate((element: HTMLElement) => element.click())

			if (await this.waitForCartDrawerState(false, 5000)) {
				return
			}
		}

		if (await this.clickActiveCartToggle()) {
			if (await this.waitForCartDrawerState(false, 5000)) {
				return
			}
		}

		if (await this.cartDrawerIsOpen()) {
			throw new Error(
				[
					'Unable to close the Live non-production cart drawer.',
					`Drawer close button found: ${(await drawerCloseButton.count()) > 0}`,
					`Cart toggle found: ${(await this.page.locator('a.wpse-cart-openerize').count()) > 0}`,
					`Current URL: ${this.page.url()}`,
				].join('\n'),
			)
		}
	}

	private async clearLiveDevMedicalRegistrationCart() {
		const cartItems = this.cartDrawer.locator('tr.woocommerce-cart-form__cart-item, .cart_item')

		for (let attempt = 1; attempt <= 20; attempt += 1) {
			if (!(await this.cartDrawerIsOpen()) && !(await this.openCartDrawer())) {
				throw new Error('Unable to reopen the Live Dev medical registration cart.')
			}

			const initialItemCount = await cartItems.count()

			if (initialItemCount === 0) {
				return
			}

			const firstItem = cartItems.first()
			const removeLink = firstItem
				.locator('td.product-remove .remove, .product-remove a, a.remove')
				.first()
			const quantityDownButton = firstItem
				.locator('button.fasd-quantity-button.fasd-quantity-down')
				.first()
			const quantityInput = firstItem.locator('input.qty, input[type="number"]').first()
			const initialQuantity = Number.parseInt(
				(await quantityInput.inputValue().catch(() => '1')) || '1',
				10,
			)
			const removalControl = (await removeLink.count()) > 0 ? removeLink : quantityDownButton

			if ((await removalControl.count()) === 0) {
				const itemText = ((await firstItem.textContent().catch(() => '')) || '')
					.replace(/\s+/g, ' ')
					.trim()

				throw new Error(`Live Dev medical registration item had no removal control: ${itemText}`)
			}

			await removalControl.evaluate((element: HTMLElement) => element.click())

			const cartChanged = await expect
				.poll(
					async () => {
						if (!(await this.cartDrawerIsOpen())) {
							await this.openCartDrawer()
						}

						const currentItemCount = await cartItems.count()

						if (currentItemCount < initialItemCount) {
							return true
						}

						const currentQuantity = Number.parseInt(
							(await cartItems
								.first()
								.locator('input.qty, input[type="number"]')
								.first()
								.inputValue()
								.catch(() => `${initialQuantity}`)) || `${initialQuantity}`,
							10,
						)

						return currentQuantity < initialQuantity
					},
					{ timeout: 10000 },
				)
				.toBeTruthy()
				.then(() => true)
				.catch(() => false)

			if (!cartChanged) {
				throw new Error(
					`Live Dev medical registration cart did not change after removal attempt ${attempt}.`,
				)
			}
		}

		throw new Error('Unable to clear the Live Dev medical registration cart after 20 attempts.')
	}

	private async clearTemporaryRegistrationCart(userType: LiveUserType) {
		await test.step('Clear the temporary registration cart', async () => {
			if (!(await this.openCartDrawer())) {
				return
			}

			if (userType === 'med' && this.isLiveDev()) {
				await this.clearLiveDevMedicalRegistrationCart()
				await this.closeCartDrawer()
				return
			}

			for (let attempt = 0; attempt < 20; attempt += 1) {
				const removeButton = this.cartDrawer
					.locator('td.product-remove .remove, .cart_item .product-remove a, a.remove')
					.first()

				if ((await removeButton.count()) === 0) {
					break
				}

				await removeButton.evaluate((element: HTMLElement) => element.click())
				await this.page.waitForTimeout(500)

				if (!(await this.cartDrawerIsOpen())) {
					await this.openCartDrawer()
				}
			}

			const emptyCartIsVisible = await this.cartDrawer
				.getByText(/you have nothing in your bag/i)
				.isVisible()
				.catch(() => false)
			let remainingItems = 0

			if (!emptyCartIsVisible) {
				remainingItems = await this.cartDrawer
					.locator('tr.woocommerce-cart-form__cart-item, .cart_item')
					.count()
			}

			if (remainingItems > 0) {
				throw new Error(`Temporary registration cart still contains ${remainingItems} item(s).`)
			}

			await this.closeCartDrawer()
		})
	}

	private async readCandidates(): Promise<ProductCandidate[]> {
		await this.waitForProducts()
		const products = this.page.locator(productSelector)

		return products.evaluateAll(
			(nodes, selectors) => {
				const candidates: ProductCandidate[] = []

				for (let index = 0; index < nodes.length; index += 1) {
					const product = nodes[index]
					const name =
						product
							.querySelector(selectors.title)
							?.textContent?.replace(/\s+/g, ' ')
							.trim() || ''
					const addControl = product.querySelector(selectors.addControl)
					const productLink = product.querySelector<HTMLAnchorElement>(selectors.productLink)

					if (!name || (!addControl && !productLink)) {
						continue
					}

					const sku =
						addControl?.getAttribute('data-product_sku') ||
						addControl?.getAttribute('data-id')
					const productUrl = productLink?.getAttribute('href')

					candidates.push({
						index,
						isMedical: Boolean(product.querySelector(selectors.medicalBadge)),
						key: sku || productUrl || name,
						name,
					})
				}

				return candidates
			},
			{
				addControl: storefrontAddToCartSelector,
				medicalBadge: '.wpse-metabadge.med-metabadge',
				productLink: '.woocommerce-loop-product__link',
				title: '.woocommerce-loop-product__title, h2, h3',
			},
		)
	}

	private async findNextCandidate(
		userType: LiveUserType,
		attemptedProducts: Set<string>,
		medicalProductAdded: boolean,
	) {
		const candidates = await this.readCandidates()
		return candidates.find(candidate => {
			if (attemptedProducts.has(candidate.key)) {
				return false
			}

			if (userType === 'rec') {
				return !candidate.isMedical
			}

			return medicalProductAdded || candidate.isMedical
		})
	}

	private async clickCandidate(candidate: ProductCandidate) {
		const product = this.page.locator(productSelector).nth(candidate.index)
		const addControl = product.locator(storefrontAddToCartSelector).first()

		if (await addControl.isVisible().catch(() => false)) {
			await addControl.scrollIntoViewIfNeeded()
			await addControl.click({ force: true })
			return true
		}

		const productLink = product.locator('.woocommerce-loop-product__link').first()

		if (!(await productLink.isVisible().catch(() => false))) {
			return false
		}

		await productLink.click()
		const productPageAddButton = this.page.locator(productPageAddToCartSelector).first()
		await productPageAddButton.waitFor({ state: 'visible', timeout: 10000 })
		await productPageAddButton.click({ force: true })
		return true
	}

	private async addCandidate(candidate: ProductCandidate) {
		const initialCartCount = await this.cartItemCount()

		if (!(await this.clickCandidate(candidate))) {
			return { added: false, reason: 'No usable add-to-cart control was found' }
		}

		const conflictModal = this.page.locator('.wpse-drawer[data-module="cart-conflict"]')
		const notices = this.page.locator(
			'.woocommerce-error, .wc-block-components-notice-banner, .wpse-snacktoast, [role="alert"]',
		)
		const deadline = Date.now() + 15000

		while (Date.now() < deadline) {
			if (await this.elementIntersectsViewport(conflictModal)) {
				const startNewCartButton = conflictModal.getByRole('button', {
					name: /start a new cart/i,
				})
				await expect(startNewCartButton).toBeVisible()
				await startNewCartButton.evaluate((element: HTMLElement) => element.click())

				if (!(await this.waitForViewportIntersection(conflictModal, false))) {
					throw new Error(`The Live cart-conflict drawer remained open at ${this.page.url()}`)
				}

				continue
			}

			const noticeCount = await notices.count()

			for (let index = 0; index < noticeCount; index += 1) {
				const notice = notices.nth(index)

				if (!(await notice.isVisible().catch(() => false))) {
					continue
				}

				const text = ((await notice.textContent().catch(() => '')) || '')
					.replace(/\s+/g, ' ')
					.trim()

				if (/cannot add|only\s+\d+\s+left|out of stock|insufficient stock|not available/i.test(text)) {
					return { added: false, reason: text }
				}
			}

			if (await this.cartDrawerIsOpen()) {
				const cartProduct = this.cartDrawer.getByText(candidate.name, { exact: false }).first()

				if (await cartProduct.isVisible().catch(() => false)) {
					return { added: true, reason: '' }
				}
			}

			const currentCartCount = await this.cartItemCount()

			if (currentCartCount > initialCartCount) {
				return { added: true, reason: '' }
			}

			await this.page.waitForTimeout(250)
		}

		const finalCartCount = await this.cartItemCount()

		return {
			added: false,
			reason: [
				'No cart confirmation appeared within 15 seconds.',
				`Cart count before: ${initialCartCount}; after: ${finalCartCount}.`,
				`Current URL: ${this.page.url()}`,
			].join(' '),
		}
	}

	private async minimumOrderIsNotMet() {
		const notices = this.page.locator('.wpse-snacktoast, .woocommerce-error, [role="alert"]')
		const noticeCount = await notices.count()

		for (let index = 0; index < noticeCount; index += 1) {
			const notice = notices.nth(index)

			if (!(await notice.isVisible().catch(() => false))) {
				continue
			}

			const text = ((await notice.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim()

			if (/(?:delivery|order) minimum (?:is )?not met|add \$?\d+(?:\.\d+)? to/i.test(text)) {
				return true
			}
		}

		return false
	}

	private async openCartPageFromDrawer() {
		if (!(await this.cartDrawerIsOpen()) && !(await this.openCartDrawer())) {
			throw new Error(`Unable to open the Live cart drawer at ${this.page.url()}`)
		}

		await expect(this.viewCartButton).toBeVisible()
		await this.viewCartButton.evaluate((element: HTMLAnchorElement) => element.click())
		await this.page
			.locator('h6:has-text("Your cart from"), h1:has-text("Cart"), .checkout-button')
			.first()
			.waitFor({ state: 'visible', timeout: 15000 })
	}

	private async provideMedicalCardIfRequired() {
		const medicalOnlyBanner = this.page
			.locator('.wpse-snacktoast.warn-toast')
			.filter({ hasText: /medical-only product in cart/i })
			.first()

		const medicalCardCheckbox = this.page.locator('input#med_included')
		const medicalCardInput = this.page.locator('input#fasd_medcard')
		const medicalCardForm = this.page
			.locator('.fasd-form.fasd-conditional-child[data-type="checkout_medcard"]')
			.first()
		const hasMedicalRequirement =
			(await medicalOnlyBanner.isVisible().catch(() => false)) ||
			(await medicalCardCheckbox.isVisible().catch(() => false))

		if (!hasMedicalRequirement) {
			return
		}

		await expect(medicalCardCheckbox).toBeVisible()
		await expect(medicalCardForm).toBeAttached()

		const revealMedicalCardForm = async () => {
			await medicalCardForm.evaluate(element => {
				const checkbox = element
					.closest('.fasd-conditional-set')
					?.querySelector<HTMLInputElement>('input#med_included')

				if (checkbox) {
					checkbox.checked = true
				}

				;(element as HTMLElement).style.setProperty('display', 'block', 'important')
				element.removeAttribute('hidden')
				element.setAttribute('aria-hidden', 'false')
			})
		}

		const newYear = new Date().getFullYear() + 1
		const medicalCardValues = {
			expiration: `${newYear}-01-01`,
			cardNumber: `${Math.floor(10000000 + Math.random() * 90000000)}`,
		}
		const fillMedicalCardValues = () =>
			medicalCardForm.evaluate(
				(element, values) => {
					const checkbox = element
						.closest('.fasd-conditional-set')
						?.querySelector<HTMLInputElement>('input#med_included')
					const setValue = (selector: string, value: string) => {
						const input = element.querySelector<HTMLInputElement | HTMLSelectElement>(selector)

						if (!input) {
							throw new Error(`Missing medical-card control: ${selector}`)
						}

						input.value = value
						input.dispatchEvent(new Event('input', { bubbles: true }))
						input.dispatchEvent(new Event('change', { bubbles: true }))
					}

					if (checkbox) {
						checkbox.checked = true
					}

					setValue('#medcard_state', 'CA')
					setValue('#medcard_exp', values.expiration)
					setValue('#medcard_no', values.cardNumber)
					setValue('#fasd_dob', '1990-01-01')
				},
				medicalCardValues,
			)

		await revealMedicalCardForm()
		await fillMedicalCardValues()

		let medicalCardFileReady = false

		for (let attempt = 1; attempt <= 3; attempt += 1) {
			await revealMedicalCardForm()
			await medicalCardInput.setInputFiles('CA-DL.jpg')

			medicalCardFileReady = await expect
				.poll(
					() =>
						medicalCardForm.evaluate(element => {
							const input = element.querySelector<HTMLInputElement>('#fasd_medcard')
							const thumbnail = element.querySelector<HTMLImageElement>('.fasd-form-thumb')
							const populatedLabel = element.querySelector<HTMLElement>('.whenfull')
							const populatedLabelIsVisible = Boolean(
								populatedLabel &&
									getComputedStyle(populatedLabel).display !== 'none' &&
									getComputedStyle(populatedLabel).visibility !== 'hidden',
							)

							return (
								(input?.files?.length || 0) > 0 ||
								Boolean(thumbnail?.getAttribute('src')) ||
								populatedLabelIsVisible
							)
						}),
					{ timeout: 10000 },
				)
				.toBeTruthy()
				.then(() => true)
				.catch(() => false)

			if (medicalCardFileReady) {
				break
			}
		}

		if (!medicalCardFileReady) {
			throw new Error(
				`The Live non-production medical-card upload never became ready. Current URL: ${this.page.url()}`,
			)
		}

		await revealMedicalCardForm()
		await fillMedicalCardValues()

		const liveDevMedicalCardResponse = this.isLiveDev()
			? this.page.waitForResponse(
					async response => {
						if (
							response.request().method() !== 'POST' ||
							!response.url().includes('/wp-admin/admin-ajax.php')
						) {
							return false
						}

						const payload = await response
							.json()
							.catch(() => null as MedicalCardUpdateResponse | null)

						return Boolean(
							payload && (payload.successCloserize !== undefined || payload.errors !== undefined),
						)
					},
					{ timeout: 30000 },
				)
			: null

		await medicalCardForm
			.locator('.fasd-form-submit')
			.first()
			.evaluate((element: HTMLElement) => element.click())

		if (liveDevMedicalCardResponse) {
			const response = await liveDevMedicalCardResponse
			const payload = (await response.json()) as MedicalCardUpdateResponse

			if (payload.outcome !== 'success') {
				throw new Error(
					[
						'Live Dev rejected the medical-card update.',
						`Message: ${payload.message || 'none'}`,
						`Errors: ${JSON.stringify(payload.errors || {})}`,
					].join('\n'),
				)
			}

			if (payload.successCloserize) {
				await this.waitForCartDrawerState(false, 10000)
			}

			if (await this.cartDrawerIsOpen()) {
				await this.closeCartDrawer()
			}

			if (!(await this.openCartDrawer())) {
				throw new Error('Unable to reopen the Live Dev cart after saving the medical card.')
			}

			const activeMedicalOnlyBanner = this.cartDrawer
				.locator('.wpse-snacktoast.warn-toast')
				.filter({ hasText: /medical-only product in cart/i })
				.first()
			const cartReady = await expect
				.poll(
					async () =>
						(await this.cartDrawerIsOpen()) &&
						(await this.checkoutButton.isVisible().catch(() => false)) &&
						!(await this.elementIntersectsViewport(activeMedicalOnlyBanner)),
					{ timeout: 20000 },
				)
				.toBeTruthy()
				.then(() => true)
				.catch(() => false)

			if (!cartReady) {
				throw new Error(
					[
						'Live Dev saved the medical card but did not expose checkout.',
						`Medical banner active: ${await this.elementIntersectsViewport(activeMedicalOnlyBanner)}`,
						`Checkout visible: ${await this.checkoutButton.isVisible().catch(() => false)}`,
						`Current URL: ${this.page.url()}`,
					].join('\n'),
				)
			}

			return
		}

		await expect
			.poll(
				async () =>
					(await this.checkoutButton.isVisible().catch(() => false)) ||
					!(await medicalOnlyBanner.isVisible().catch(() => false)),
				{ timeout: 20000 },
			)
			.toBeTruthy()

		if (!(await this.checkoutButton.isVisible().catch(() => false))) {
			await this.openCartDrawer()
		}
	}
}
