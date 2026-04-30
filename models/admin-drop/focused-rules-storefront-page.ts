import test, { expect, Locator, Page } from '@playwright/test'

const cartNoticeSelector = [
	'.woocommerce-error',
	'.woocommerce-message',
	'.woocommerce-info',
	'.wc-block-components-notice-banner',
	'.wpse-snacktoast',
	'[role="alert"]',
].join(', ')
const defaultDeliveryAddress = '123 Rodeo Dr Beverly Hills'

export type FocusedRulesFulfillment = 'Pickup' | 'Delivery'

export class FocusedRulesStorefrontPage {
	readonly page: Page
	readonly ageGateChallenge: Locator
	readonly passAgeGateButton: Locator
	readonly passwordInput: Locator
	readonly deliveryAddressInput: Locator
	readonly deliveryAddressSubmitButton: Locator

	constructor(page: Page) {
		this.page = page
		this.ageGateChallenge = page.locator('.age-gate-challenge')
		this.passAgeGateButton = page.getByText("I'm over 21 or a qualified patient", { exact: true })
		this.passwordInput = page.locator('input[name="post_password"]').first()
		this.deliveryAddressInput = page.locator('#fasd_address').first()
		this.deliveryAddressSubmitButton = page.locator('button.wpse-button-primary.fasd-form-submit').first()
	}

	async clearCart() {
		await test.step('Clear storefront cart', async () => {
			await this.gotoWithGateHandling('/cart/')

			for (let pass = 0; pass < 20; pass += 1) {
				const removeLink = this.page.locator('.cart_item .product-remove a, a.remove').first()
				const hasRemoveLink = await removeLink.isVisible().catch(() => false)

				if (!hasRemoveLink) {
					return
				}

				await removeLink.click()
				await this.page.waitForLoadState('networkidle').catch(() => {})
				await this.page.waitForTimeout(500)
			}

			throw new Error('Unable to clear storefront cart after 20 remove attempts')
		})
	}

	async addProductBySku(sku: string, quantity = 1, fulfillment: FocusedRulesFulfillment = 'Pickup') {
		await test.step(`Add SKU ${sku} to cart ${quantity} time(s)`, async () => {
			await this.openShopForFulfillment(fulfillment)

			for (let index = 0; index < quantity; index += 1) {
				const addButton = await this.findAddToCartButtonBySku(sku, fulfillment)
				await addButton.scrollIntoViewIfNeeded()
				await expect(addButton, `Expected add-to-cart control for SKU ${sku}`).toBeVisible()
				await addButton.click()
				await this.acceptCartConflictIfPresent()
				await this.page.waitForTimeout(1000)
				await this.closeCartDrawerIfPresent()
			}
		})
	}

	async selectFulfillment(fulfillment: FocusedRulesFulfillment) {
		await test.step(`Select ${fulfillment} fulfillment`, async () => {
			const fulfillmentLabel = this.page.locator(`label:has-text("${fulfillment}")`).first()
			const isFulfillmentVisible = await fulfillmentLabel.isVisible({ timeout: 2000 }).catch(() => false)

			if (!isFulfillmentVisible) {
				return
			}

			await fulfillmentLabel.click()

			if (fulfillment === 'Delivery') {
				await this.fillDeliveryAddressIfPresent()
			}

			const submitButton = this.page.locator('#fulfillerSubmit, button:has-text("Continue"), button:has-text("Submit")').first()
			const hasSubmitButton = await submitButton.isVisible({ timeout: 2000 }).catch(() => false)

			if (hasSubmitButton) {
				await submitButton.click()
				await this.page.waitForLoadState('networkidle').catch(() => {})
				await this.page.waitForTimeout(500)
			}

			if (fulfillment === 'Delivery') {
				await this.fillDeliveryAddressIfPresent()
			}
		})
	}

	async goToCart() {
		await test.step('Open storefront cart', async () => {
			await this.gotoWithGateHandling('/cart/')
			await expect
				.poll(async () => {
					const hasCartItem = await this.page.locator('.cart_item').first().isVisible().catch(() => false)
					const hasEmptyCartText = await this.page.getByText(/cart is currently empty/i).isVisible().catch(() => false)

					return hasCartItem || hasEmptyCartText
				})
				.toBe(true)
		})
	}

	async getCartQuantity(productName: string) {
		return test.step(`Read cart quantity for ${productName}`, async () => {
			const row = this.cartRowByProductName(productName)
			await expect(row, `Expected cart row for ${productName}`).toBeVisible()
			const quantityField = row.locator('input.qty, .qty').first()
			await expect(quantityField, `Expected quantity field for ${productName}`).toBeVisible()

			const tagName = await quantityField.evaluate(element => element.tagName.toLowerCase())

			if (tagName === 'input') {
				return Number.parseInt(await quantityField.inputValue(), 10)
			}

			return Number.parseInt(((await quantityField.textContent()) || '').trim(), 10)
		})
	}

	async getCartTotalAmount() {
		return test.step('Read cart/order total amount', async () => {
			const totalSelectors = [
				'.order-total .woocommerce-Price-amount bdi',
				'.order-total .amount',
				'.cart_totals .woocommerce-Price-amount bdi',
				'.cart_totals .amount',
			]

			for (const selector of totalSelectors) {
				const amounts = this.page.locator(selector)
				const count = await amounts.count()

				for (let index = count - 1; index >= 0; index -= 1) {
					const amount = amounts.nth(index)
					const isVisible = await amount.isVisible().catch(() => false)

					if (!isVisible) {
						continue
					}

					const parsedAmount = this.parseMoney((await amount.textContent()) || '')

					if (parsedAmount !== null) {
						return parsedAmount
					}
				}
			}

			const subtotalAmounts = this.page.locator('.cart_item .product-subtotal .amount, .cart_item .product-subtotal bdi')
			const subtotalCount = await subtotalAmounts.count()
			let subtotal = 0

			for (let index = 0; index < subtotalCount; index += 1) {
				const parsedAmount = this.parseMoney((await subtotalAmounts.nth(index).textContent()) || '')

				if (parsedAmount !== null) {
					subtotal += parsedAmount
				}
			}

			if (subtotal > 0) {
				return subtotal
			}

			throw new Error('Unable to read a cart/order total amount from the cart page')
		})
	}

	async getCartSubtotalAmount() {
		return test.step('Read cart subtotal amount', async () => {
			const subtotalSelectors = [
				'.cart-subtotal .woocommerce-Price-amount bdi',
				'.cart-subtotal .amount',
				'.cart-subtotal',
				'[data-testid="cart-subtotal"]',
			]

			for (const selector of subtotalSelectors) {
				const amounts = this.page.locator(selector)
				const count = await amounts.count()

				for (let index = 0; index < count; index += 1) {
					const amount = amounts.nth(index)
					const isVisible = await amount.isVisible().catch(() => false)

					if (!isVisible) {
						continue
					}

					const parsedAmount = this.parseMoney((await amount.textContent()) || '')

					if (parsedAmount !== null) {
						return parsedAmount
					}
				}
			}

			const bodyText = await this.getBodyText()
			const subtotalFromBody = bodyText.match(/Subtotal\s*\$?\s*([\d,]+(?:\.\d+)?)/i)

			if (subtotalFromBody) {
				const parsedAmount = this.parseMoney(subtotalFromBody[1])

				if (parsedAmount !== null) {
					return parsedAmount
				}
			}

			const subtotalAmounts = this.page.locator('.cart_item .product-subtotal .amount, .cart_item .product-subtotal bdi')
			const subtotalCount = await subtotalAmounts.count()
			let subtotal = 0

			for (let index = 0; index < subtotalCount; index += 1) {
				const parsedAmount = this.parseMoney((await subtotalAmounts.nth(index).textContent()) || '')

				if (parsedAmount !== null) {
					subtotal += parsedAmount
				}
			}

			if (subtotal > 0) {
				return subtotal
			}

			throw new Error('Unable to read a cart subtotal amount from the cart page')
		})
	}

	async setCartQuantity(productName: string, quantity: number) {
		await test.step(`Set cart quantity for ${productName} to ${quantity}`, async () => {
			const row = this.cartRowByProductName(productName)
			await expect(row, `Expected cart row for ${productName}`).toBeVisible()
			const quantityInput = row.locator('input[name^="cart["][name$="[qty]"], input.qty').first()
			await expect(quantityInput, `Expected editable quantity input for ${productName}`).toBeVisible()

			await quantityInput.fill(`${quantity}`)
			await quantityInput.evaluate(element => {
				element.dispatchEvent(new Event('input', { bubbles: true }))
				element.dispatchEvent(new Event('change', { bubbles: true }))
			})
			await quantityInput.press('Tab')

			const updateButton = this.page.locator('button[name="update_cart"], input[name="update_cart"]').first()
			const hasUpdateButton = await updateButton.isVisible().catch(() => false)

			if (hasUpdateButton) {
				await expect(updateButton).toBeEnabled({ timeout: 5000 }).catch(() => {})

				if (await updateButton.isEnabled().catch(() => false)) {
					await updateButton.click()
					await this.page.waitForLoadState('networkidle').catch(() => {})
					await this.page.waitForTimeout(500)
					await expect
						.poll(async () => this.readCartQuantityValue(productName), {
							message: `Expected cart quantity for ${productName} to update to ${quantity}`,
						})
						.toBe(quantity)
					return
				}
			}

			await quantityInput.press('Enter')
			await this.page.waitForLoadState('networkidle').catch(() => {})
			await this.page.waitForTimeout(500)
			await expect
				.poll(async () => this.readCartQuantityValue(productName), {
					message: `Expected cart quantity for ${productName} to update to ${quantity}`,
				})
				.toBe(quantity)
		})
	}

	async attemptCheckout() {
		return test.step('Attempt to continue to checkout', async () => {
			const checkoutButton = this.page
				.locator(
					[
						'.checkout-button',
						'a.checkout-button',
						'button:has-text("Checkout")',
						'button:has-text("Continue to checkout")',
						'a:has-text("Continue to checkout")',
					].join(', '),
				)
				.first()
			await expect(checkoutButton, 'Expected a checkout button on the cart page').toBeVisible()
			const checkoutDisabledByDom = await checkoutButton
				.evaluate(element => {
					const htmlElement = element as HTMLElement

					return (
						element.matches(':disabled') ||
						htmlElement.getAttribute('aria-disabled') === 'true' ||
						htmlElement.hasAttribute('disabled') ||
						htmlElement.classList.contains('disabled') ||
						htmlElement.classList.contains('is-disabled')
					)
				})
				.catch(() => false)
			const checkoutEnabled = await checkoutButton.isEnabled().catch(() => false)
			const checkoutDisabled = checkoutDisabledByDom || !checkoutEnabled

			if (!checkoutDisabled) {
				await checkoutButton.click()
				await this.page.waitForLoadState('networkidle').catch(() => {})
				await this.page.waitForTimeout(1000)
			}

			return {
				url: this.page.url(),
				notices: await this.getNoticeText(),
				bodyText: await this.getBodyText(),
				checkoutDisabled,
				checkoutEnabled,
			}
		})
	}

	async getNoticeText() {
		const notices = this.page.locator(cartNoticeSelector)
		const count = await notices.count()
		const noticeTexts: string[] = []

		for (let index = 0; index < count; index += 1) {
			const notice = notices.nth(index)
			const isVisible = await notice.isVisible().catch(() => false)

			if (isVisible) {
				noticeTexts.push(((await notice.textContent()) || '').trim())
			}
		}

		return noticeTexts.filter(Boolean).join('\n')
	}

	async getBodyText() {
		return this.page.evaluate(() => document.body.innerText || '')
	}

	hasMinimumOrderBlockText(text: string) {
		const normalizedText = text.replace(/\s+/g, ' ').toLowerCase()

		return (
			/order minimum (?:is )?not met/.test(normalizedText) ||
			/minimum[^.]*not met/.test(normalizedText) ||
			/add\s+\$?\d+(?:\.\d+)?\s+to check out/.test(normalizedText)
		)
	}

	private async openShopForFulfillment(fulfillment: FocusedRulesFulfillment) {
		await this.gotoWithGateHandling('/shop/')
		await this.selectFulfillment(fulfillment)
	}

	private async gotoWithGateHandling(path: string) {
		await this.page.goto(path, { waitUntil: 'domcontentloaded' })
		await this.passAgeGateIfPresent()
		await this.unlockPrivateStoreIfPresent()
		await this.page.waitForLoadState('networkidle').catch(() => {})
	}

	private async passAgeGateIfPresent() {
		const isVisible = await this.ageGateChallenge.first().isVisible({ timeout: 3000 }).catch(() => false)

		if (!isVisible) {
			return
		}

		await this.passAgeGateButton.click()
		await expect(this.ageGateChallenge.first()).toBeHidden({ timeout: 10000 })
	}

	private async unlockPrivateStoreIfPresent() {
		const isPasswordVisible = await this.passwordInput.isVisible({ timeout: 2000 }).catch(() => false)

		if (!isPasswordVisible) {
			return
		}

		const password = process.env.CHECKOUT_PASSWORD
		expect(password, 'CHECKOUT_PASSWORD must be set when storefront password gate is visible').toBeTruthy()
		await this.passwordInput.fill(`${password}`)
		await this.passwordInput.press('Enter')
		await expect(this.passwordInput).toBeHidden({ timeout: 10000 })
	}

	private async fillDeliveryAddressIfPresent() {
		const isAddressVisible = await this.deliveryAddressInput.isVisible({ timeout: 2000 }).catch(() => false)

		if (!isAddressVisible) {
			return
		}

		const address = process.env.ADMIN_DROP_DELIVERY_ADDRESS || defaultDeliveryAddress
		await this.deliveryAddressInput.fill(address)
		const hasAutocompleteSuggestion = await this.page.locator('.pac-item').first().isVisible({ timeout: 5000 }).catch(() => false)

		if (hasAutocompleteSuggestion) {
			await this.deliveryAddressInput.press('ArrowDown')
		}

		await this.deliveryAddressInput.press('Enter').catch(() => {})
		const hasSubmitButton = await this.deliveryAddressSubmitButton.isVisible({ timeout: 2000 }).catch(() => false)

		if (hasSubmitButton) {
			await this.deliveryAddressSubmitButton.click()
			await this.page.waitForLoadState('networkidle').catch(() => {})
			await this.page.waitForTimeout(500)
		}
	}

	private async findAddToCartButtonBySku(sku: string, fulfillment: FocusedRulesFulfillment) {
		let addButton = this.page.locator(`[data-product_sku="${sku}"], [data-product_sku*="${sku}"]`).first()
		let isVisible = await addButton.isVisible({ timeout: 10000 }).catch(() => false)

		if (isVisible) {
			return addButton
		}

		await this.gotoWithGateHandling('/')
		await this.selectFulfillment(fulfillment)
		addButton = this.page.locator(`[data-product_sku="${sku}"], [data-product_sku*="${sku}"]`).first()
		isVisible = await addButton.isVisible({ timeout: 10000 }).catch(() => false)

		if (!isVisible) {
			throw new Error(`Could not find an add-to-cart control for SKU ${sku} on /shop/ or /`)
		}

		return addButton
	}

	private cartRowByProductName(productName: string) {
		return this.page.locator('.cart_item').filter({ hasText: productName }).first()
	}

	private async readCartQuantityValue(productName: string) {
		const row = this.cartRowByProductName(productName)
		const quantityField = row.locator('input[name^="cart["][name$="[qty]"], input.qty, .qty').first()
		const isVisible = await quantityField.isVisible().catch(() => false)

		if (!isVisible) {
			return Number.NaN
		}

		const tagName = await quantityField.evaluate(element => element.tagName.toLowerCase())

		if (tagName === 'input') {
			return Number.parseInt(await quantityField.inputValue(), 10)
		}

		return Number.parseInt(((await quantityField.textContent()) || '').trim(), 10)
	}

	private parseMoney(text: string) {
		const normalized = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)

		if (!normalized) {
			return null
		}

		return Number.parseFloat(normalized[0])
	}

	private async acceptCartConflictIfPresent() {
		const conflictModal = this.page.locator('.wpse-drawer[data-module="cart-conflict"]')
		const isVisible = await conflictModal.isVisible({ timeout: 3000 }).catch(() => false)

		if (!isVisible) {
			return
		}

		const startNewCartButton = conflictModal.getByRole('button', { name: /start a new cart/i })
		await expect(startNewCartButton).toBeVisible()
		await startNewCartButton.click()
		await expect(conflictModal).toBeHidden({ timeout: 10000 })
	}

	private async closeCartDrawerIfPresent() {
		const cartDrawer = this.page.locator('#cartDrawer')
		const isVisible = await cartDrawer.isVisible({ timeout: 2000 }).catch(() => false)

		if (!isVisible) {
			return
		}

		const closeButton = this.page
			.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
			.last()
		await expect(closeButton).toBeVisible()
		await closeButton.click()
		await cartDrawer.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
	}
}
