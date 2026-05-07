import test, { Browser, expect, Locator, Page, TestInfo } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })
import { isMedicalUsage, type TestUsageType } from '../utils/usage-types'

type GoToCartOptions = {
	requireItems?: boolean
}

type CartLoadState = {
	hasCartItem: boolean
	hasCheckoutButton: boolean
	hasCartTitle: boolean
	hasEmptyCartText: boolean
	url: string
}

type FulfillmentReadyState = {
	hasAddToCartButton: boolean
	hasFulfillmentNav: boolean
	hasOpenFulfillmentModal: boolean
	url: string
}

export type ShopFulfillment = 'Pickup' | 'Delivery'

export type StorefrontProductCandidate = {
	menuIndex: number
	name: string
	price: number
	sku: string | null
}

export type MinimumOrderBannerState = {
	isVisible: boolean
	text: string | null
	remainingAmount: number | null
}

export type StorefrontCheckoutState = {
	isVisible: boolean
	isEnabled: boolean
	isReachable: boolean
	url: string
}

const minimumOrderNoticeSelector = [
	'.woocommerce-error',
	'.woocommerce-message',
	'.woocommerce-info',
	'.wc-block-components-notice-banner',
	'.wpse-snacktoast',
	'[role="alert"]',
].join(', ')

const storefrontAddToCartSelector = [
	'a.add_to_cart_button',
	'button.add_to_cart_button',
	'button.product_type_simple.fasd_to_cart.ajax_groove',
	'button.fasd_to_cart',
	'[data-product_sku].fasd_to_cart',
	'[data-product_sku].add_to_cart_button',
].join(', ')

const defaultDeliveryAddress = '123 Rodeo Dr Beverly Hills'

export class ShopPage {
	readonly baseUrl: string
	readonly page: Page
	readonly browserName: any
	readonly workerInfo: TestInfo
	readonly addProductButtons
	readonly passwordField: Locator
	readonly lostPasswordLink: Locator
	readonly rememberMeCheckBox: Locator
	readonly loginButton: Locator
	readonly createAccountLink: Locator
	readonly cartTitle: Locator
	constructor(page: Page, browserName: any, workerInfo: TestInfo) {
		this.page = page
		this.browserName = browserName
		this.workerInfo = workerInfo
		this.baseUrl = process.env.BASE_URL
		this.cartTitle = this.page.locator('h1.injected-title:has-text("Cart")')
	}

	async randomizeCartItems() {
		return Math.random() * (2 - -2 + -2)
	}

	private getCartPath() {
		if ((process.env.BASE_URL ?? '').includes('thelist.theflowery.co')) {
			return '/reservations/'
		}

		return '/cart/'
	}

	private async getCartLoadState(): Promise<CartLoadState> {
		return {
			hasCartItem: await this.page
				.locator('.cart_item')
				.first()
				.isVisible()
				.catch(() => false),
			hasCheckoutButton: await this.page
				.locator('.checkout-button')
				.first()
				.isVisible()
				.catch(() => false),
			hasCartTitle: await this.page
				.locator('h1:has-text("Cart"), h1.injected-title:has-text("Cart")')
				.first()
				.isVisible()
				.catch(() => false),
			hasEmptyCartText: await this.page
				.getByText(/cart is currently empty/i)
				.first()
				.isVisible()
				.catch(() => false),
			url: this.page.url(),
		}
	}

	private isFlEnvironment() {
		const baseUrl = (process.env.BASE_URL ?? '').toLowerCase()
		const envId = (process.env.ENV_ID ?? '').toLowerCase()
		return baseUrl.includes('thelist.theflowery.co') || /(^|-)fl($|-)/.test(envId)
	}

	private getFulfillmentPath(fulfillment: string) {
		if (fulfillment.toLowerCase() === 'pickup') {
			return '/#pickup'
		}
		return this.isFlEnvironment() ? '/#deliver' : '/#pickup-deliver'
	}

	private async getBodyPreview() {
		const bodyText = await this.page
			.locator('body')
			.innerText({ timeout: 1000 })
			.catch(() => '')

		return bodyText.replace(/\s+/g, ' ').trim().slice(0, 500)
	}

	private async getBodyText() {
		return this.page.evaluate(() => document.body.innerText || '')
	}

	private parseMoney(text: string) {
		const normalized = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)

		if (!normalized) {
			return null
		}

		return Number.parseFloat(normalized[0])
	}

	private hasMinimumOrderBlockText(text: string) {
		const normalizedText = text.replace(/\s+/g, ' ').toLowerCase()

		return (
			/order minimum (?:is )?not met/.test(normalizedText) ||
			/minimum[^.]*not met/.test(normalizedText) ||
			/add\s+\$?\d+(?:\.\d+)?\s+to check out/.test(normalizedText)
		)
	}

	private parseMinimumOrderRemainingAmount(text: string) {
		const remainingMatch = text
			.replace(/,/g, '')
			.match(/add\s+\$?\s*(\d+(?:\.\d+)?)\s+to check out/i)

		if (!remainingMatch) {
			return null
		}

		return Number.parseFloat(remainingMatch[1])
	}

	private async collectVisibleTexts(locator: Locator, limit = 20) {
		const texts: string[] = []
		const count = await locator.count().catch(() => 0)

		for (let index = 0; index < count && texts.length < limit; index += 1) {
			const item = locator.nth(index)
			const isVisible = await item.isVisible().catch(() => false)

			if (!isVisible) {
				continue
			}

			const text = (
				(await item.textContent().catch(() => null)) ||
				(await item.getAttribute('value').catch(() => null)) ||
				''
			)
				.replace(/\s+/g, ' ')
				.trim()

			if (text) {
				texts.push(text)
			}
		}

		return texts
	}

	private async getVisibleFulfillmentOptionTexts() {
		const modalRoot = await this.getVisibleFulfillmentModalRoot()

		if (modalRoot) {
			return this.collectVisibleTexts(
				modalRoot.locator('button, [role="button"], [role="tab"], label, a, input[type="submit"]'),
			)
		}

		return this.collectVisibleTexts(
			this.page.locator(
				[
					'#fulfillmentElement button',
					'#fulfillmentElement [role="button"]',
					'#fulfillmentElement label',
					'.wcseZone[data-revealed="fulfillment"] button',
					'.wcseZone[data-revealed="fulfillment"] [role="button"]',
					'[role="dialog"] button',
					'[role="dialog"] [role="button"]',
				].join(', '),
			),
		)
	}

	private async getVisibleFulfillmentSubmitTexts() {
		const modalRoot = await this.getVisibleFulfillmentModalRoot()

		if (modalRoot) {
			return this.collectVisibleTexts(
				modalRoot.locator(
					'#fulfillerSubmit, button:has-text("Submit"), a:has-text("Submit"), [role="button"]:has-text("Submit"), input[type="submit"]',
				),
			)
		}

		return this.collectVisibleTexts(
			this.page.locator(
				[
					'#fulfillerSubmit',
					'#fulfillmentElement button',
					'#fulfillmentElement a',
					'#fulfillmentElement [role="button"]',
					'.wcseZone[data-revealed="fulfillment"] button',
					'.wcseZone[data-revealed="fulfillment"] a',
					'.wcseZone[data-revealed="fulfillment"] [role="button"]',
					'input[type="submit"]',
				].join(', '),
			),
		)
	}

	private async findFirstVisibleLocator(candidates: Locator[], timeout = 2000) {
		const deadline = Date.now() + timeout

		while (Date.now() < deadline) {
			for (const candidate of candidates) {
				const count = await candidate.count().catch(() => 0)

				for (let index = 0; index < count; index += 1) {
					const item = candidate.nth(index)

					if (await item.isVisible({ timeout: 100 }).catch(() => false)) {
						return item
					}
				}

				if (count === 0 && (await candidate.isVisible({ timeout: 100 }).catch(() => false))) {
					return candidate
				}
			}

			await this.page.waitForTimeout(100)
		}

		return null
	}

	private async getVisibleFulfillmentModalRoot(timeout = 1000) {
		const headingPattern = /how do you want your order/i
		const candidates = [
			this.page
				.locator('.wcseZone[data-revealed="fulfillment"] #fulfillmentElement')
				.filter({ hasText: headingPattern }),
			this.page.locator('#fulfillmentElement').filter({ hasText: headingPattern }),
			this.page.locator('[role="dialog"]').filter({ hasText: headingPattern }),
			this.page
				.locator('.wcseZone[data-revealed="fulfillment"]')
				.filter({ hasText: headingPattern }),
		]

		return this.findFirstVisibleLocator(candidates, timeout)
	}

	private async findFulfillmentOption(
		fulfillment: string,
		timeout = 2000,
		modalOnly = false,
	) {
		const exactFulfillment = new RegExp(`^${fulfillment}$`, 'i')
		const modalRoot = modalOnly ? await this.getVisibleFulfillmentModalRoot(timeout) : null
		const modalCandidates = modalRoot
			? [
					modalRoot.getByRole('button', { name: exactFulfillment }),
					modalRoot.getByRole('tab', { name: exactFulfillment }),
					modalRoot.getByText(fulfillment, { exact: true }),
					modalRoot.locator(`label:has-text("${fulfillment}")`),
					modalRoot
						.locator('button, [role="button"], [role="tab"]')
						.filter({ hasText: exactFulfillment }),
				]
			: [
					this.page
						.locator('.wcseZone[data-revealed="fulfillment"] #fulfillmentElement')
						.getByRole('button', { name: exactFulfillment }),
					this.page
						.locator('.wcseZone[data-revealed="fulfillment"]')
						.getByRole('button', { name: exactFulfillment }),
					this.page
						.locator('[role="dialog"]')
						.filter({ hasText: /how do you want your order/i })
						.getByRole('button', { name: exactFulfillment }),
					this.page.locator('#fulfillmentElement').getByText(fulfillment, { exact: true }),
					this.page.locator('#fulfillmentElement').locator(`label:has-text("${fulfillment}")`),
					this.page
						.locator('#fulfillmentElement')
						.locator('button, [role="button"]')
						.filter({ hasText: exactFulfillment }),
				]
		const pageCandidates = [
			this.page.locator(`label:has-text("${fulfillment}")`),
			this.page.getByRole('button', { name: exactFulfillment }),
			this.page.getByRole('tab', { name: exactFulfillment }),
			this.page.locator(`button:has-text("${fulfillment}")`),
			this.page.locator(`[role="button"]:has-text("${fulfillment}")`),
		]
		const candidates = modalOnly ? modalCandidates : [...modalCandidates, ...pageCandidates]

		return this.findFirstVisibleLocator(candidates, timeout)
	}

	private async isFulfillmentModalOpen() {
		return (await this.getVisibleFulfillmentModalRoot(500)) !== null
	}

	private async findFulfillmentSubmitButton() {
		const modalRoot = await this.getVisibleFulfillmentModalRoot()
		const submitButtonCandidates = modalRoot
			? [
					modalRoot.locator('#fulfillerSubmit'),
					modalRoot.locator('button.wpse-button-primary:has-text("Submit")'),
					modalRoot.locator('button:has-text("Submit")'),
					modalRoot.locator('a.wpse-button-primary:has-text("Submit")'),
					modalRoot.locator('[role="button"]:has-text("Submit")'),
					modalRoot.getByRole('button', { name: /^submit$/i }),
					modalRoot.locator('input[type="submit"][value="Submit"]'),
				]
			: [
					this.page.locator('#fulfillerSubmit'),
					this.page.locator('#fulfillmentElement button.wpse-button-primary:has-text("Submit")'),
					this.page.locator('#fulfillmentElement button:has-text("Submit")'),
					this.page.locator('#fulfillmentElement a.wpse-button-primary:has-text("Submit")'),
					this.page.locator('#fulfillmentElement [role="button"]:has-text("Submit")'),
					this.page.locator('.wcseZone[data-revealed="fulfillment"] button.wpse-button-primary:has-text("Submit")'),
					this.page.locator('.wcseZone[data-revealed="fulfillment"] button:has-text("Submit")'),
					this.page.locator('.wcseZone[data-revealed="fulfillment"] a.wpse-button-primary:has-text("Submit")'),
					this.page.locator('.wcseZone[data-revealed="fulfillment"] [role="button"]:has-text("Submit")'),
					this.page.getByRole('button', { name: /^submit$/i }),
					this.page.locator('button:has-text("Submit")'),
					this.page.locator('[role="button"]:has-text("Submit")'),
					this.page.locator('.wpse-button-primary:has-text("Submit")'),
					this.page.locator('a:has-text("Submit")'),
					this.page.locator('input[type="submit"][value="Submit"]'),
				]

		return this.findFirstVisibleLocator(submitButtonCandidates, 2000)
	}

	private async resolveOpenFulfillmentModal(fulfillment: string) {
		if (!(await this.isFulfillmentModalOpen())) {
			return false
		}

		const fulfillmentOption = await this.findFulfillmentOption(fulfillment, 5000, true)

		if (!fulfillmentOption) {
			throw new Error(
				[
					`Fulfillment modal is open but no visible "${fulfillment}" option was found inside it.`,
					`Current URL: ${this.page.url()}`,
					`Visible fulfillment option texts: ${(await this.getVisibleFulfillmentOptionTexts()).join(' | ') || 'none'}`,
					`Visible submit texts: ${(await this.getVisibleFulfillmentSubmitTexts()).join(' | ') || 'none'}`,
					`Body preview: ${await this.getBodyPreview()}`,
				].join('\n'),
			)
		}

		await fulfillmentOption.click({ force: true })
		await this.page.waitForTimeout(250)

		if (fulfillment.toLowerCase() === 'delivery') {
			await this.fillDeliveryAddressIfPresent()
		}

		if (!(await this.isFulfillmentModalOpen())) {
			await this.page.waitForTimeout(500)
			return true
		}

		const submitButton = await this.findFulfillmentSubmitButton()

		if (submitButton) {
			await submitButton.click({ force: true })
			await this.page.waitForTimeout(500)

			if (fulfillment.toLowerCase() === 'delivery') {
				await this.fillDeliveryAddressIfPresent()
			}

			await expect
				.poll(async () => this.isFulfillmentModalOpen(), {
					message: `Expected fulfillment modal to close after submitting ${fulfillment}`,
					timeout: 10000,
				})
				.toBe(false)
			await this.page.waitForTimeout(500)
			return true
		}

		throw new Error(
			[
				`Fulfillment modal is open for "${fulfillment}" but no visible Submit control was found.`,
				`Current URL: ${this.page.url()}`,
				`Visible fulfillment option texts: ${(await this.getVisibleFulfillmentOptionTexts()).join(' | ') || 'none'}`,
				`Visible submit texts: ${(await this.getVisibleFulfillmentSubmitTexts()).join(' | ') || 'none'}`,
				`Body preview: ${await this.getBodyPreview()}`,
			].join('\n'),
		)
	}

	private async fillDeliveryAddressIfPresent() {
		const deliveryAddressInput = this.page.locator('#fasd_address').first()
		const isAddressVisible = await deliveryAddressInput
			.isVisible({ timeout: 2000 })
			.catch(() => false)

		if (!isAddressVisible) {
			return
		}

		const address = process.env.ADMIN_DROP_DELIVERY_ADDRESS || defaultDeliveryAddress
		await deliveryAddressInput.fill(address)

		const hasAutocompleteSuggestion = await this.page
			.locator('.pac-item')
			.first()
			.isVisible({ timeout: 5000 })
			.catch(() => false)

		if (hasAutocompleteSuggestion) {
			await deliveryAddressInput.press('ArrowDown')
		}

		await deliveryAddressInput.press('Enter')

		const deliveryAddressSubmitButton = this.page
			.locator('button.wpse-button-primary.fasd-form-submit')
			.first()
		const hasSubmitButton = await deliveryAddressSubmitButton
			.isVisible({ timeout: 2000 })
			.catch(() => false)

		if (hasSubmitButton) {
			await deliveryAddressSubmitButton.click()
			await this.page.waitForTimeout(500)
		}
	}

	private async getFulfillmentReadyState(): Promise<FulfillmentReadyState> {
		return {
			hasAddToCartButton: await this.page
				.locator(storefrontAddToCartSelector)
				.first()
				.isVisible()
				.catch(() => false),
			hasFulfillmentNav: await this.page
				.locator('button.wcse-nav')
				.first()
				.isVisible()
				.catch(() => false),
			hasOpenFulfillmentModal: await this.isFulfillmentModalOpen(),
			url: this.page.url(),
		}
	}

	private async waitForFulfillmentReady(fulfillment: string) {
		const deadline = Date.now() + 15_000
		let lastState: FulfillmentReadyState | null = null

		while (Date.now() < deadline) {
			lastState = await this.getFulfillmentReadyState()

			if (
				!lastState.hasOpenFulfillmentModal &&
				(lastState.hasFulfillmentNav || lastState.hasAddToCartButton)
			) {
				return
			}

			await this.page.waitForTimeout(500)
		}

		throw new Error(
			[
				`Fulfillment did not initialize for "${fulfillment}" within 15000ms.`,
				`Current URL: ${lastState?.url || this.page.url()}`,
				`Fulfillment nav visible: ${lastState?.hasFulfillmentNav ?? false}`,
				`Fulfillment modal open: ${lastState?.hasOpenFulfillmentModal ?? false}`,
				`Add-to-cart button visible: ${lastState?.hasAddToCartButton ?? false}`,
				`Body preview: ${await this.getBodyPreview()}`,
			].join('\n'),
		)
	}

	private async ensureFulfillmentSelected(fulfillment: string) {
		if (await this.resolveOpenFulfillmentModal(fulfillment)) {
			await this.waitForFulfillmentReady(fulfillment)
			return
		}

		if (process.env.NEXT_VERSION !== 'true') {
			return
		}

		const fulfillmentNav = this.page.locator('button.wcse-nav').first()

		if (
			(await fulfillmentNav.isVisible({ timeout: 2000 }).catch(() => false)) &&
			!(await this.isFulfillmentModalOpen())
		) {
			const currentFulfillment = ((await fulfillmentNav.textContent().catch(() => '')) || '').toLowerCase()

			if (currentFulfillment.includes(fulfillment.toLowerCase())) {
				await this.waitForFulfillmentReady(fulfillment)
				return
			}

			await fulfillmentNav.click()
			await this.page.waitForTimeout(500)

			if (await this.resolveOpenFulfillmentModal(fulfillment)) {
				await this.waitForFulfillmentReady(fulfillment)
				return
			}
		}

		let fulfillmentOption = await this.findFulfillmentOption(fulfillment)

		if (fulfillmentOption) {
			await fulfillmentOption.click({ force: true })

			if (fulfillment.toLowerCase() === 'delivery') {
				await this.fillDeliveryAddressIfPresent()
			}

			if (await this.resolveOpenFulfillmentModal(fulfillment)) {
				await this.waitForFulfillmentReady(fulfillment)
				return
			}

			await this.waitForFulfillmentReady(fulfillment)
			return
		}

		if (!fulfillmentOption) {
			await this.page.goto(this.getFulfillmentPath(fulfillment))
			await this.page.waitForTimeout(1000)

			if (await this.resolveOpenFulfillmentModal(fulfillment)) {
				await this.waitForFulfillmentReady(fulfillment)
				return
			}

			if (
				(await fulfillmentNav.isVisible({ timeout: 2000 }).catch(() => false)) &&
				!(await this.isFulfillmentModalOpen())
			) {
				const currentFulfillment = ((await fulfillmentNav.textContent().catch(() => '')) || '').toLowerCase()

				if (currentFulfillment.includes(fulfillment.toLowerCase())) {
					await this.waitForFulfillmentReady(fulfillment)
					return
				}

				await fulfillmentNav.click()
				await this.page.waitForTimeout(500)

				if (await this.resolveOpenFulfillmentModal(fulfillment)) {
					await this.waitForFulfillmentReady(fulfillment)
					return
				}
			}

			fulfillmentOption = await this.findFulfillmentOption(fulfillment, 10_000)
		}

		if (!fulfillmentOption) {
			throw new Error(
					[
						`Could not find a visible "${fulfillment}" fulfillment option.`,
						`Current URL: ${this.page.url()}`,
						`Fulfillment nav visible: ${await fulfillmentNav.isVisible().catch(() => false)}`,
						`Fulfillment modal open: ${await this.isFulfillmentModalOpen()}`,
						`Visible fulfillment option texts: ${(await this.getVisibleFulfillmentOptionTexts()).join(' | ') || 'none'}`,
						`Visible submit texts: ${(await this.getVisibleFulfillmentSubmitTexts()).join(' | ') || 'none'}`,
						`Add-to-cart button visible: ${await this.page.locator(storefrontAddToCartSelector).first().isVisible().catch(() => false)}`,
						`Body preview: ${await this.getBodyPreview()}`,
					].join('\n'),
			)
		}

		await fulfillmentOption.click({ force: true })

		if (fulfillment.toLowerCase() === 'delivery') {
			await this.fillDeliveryAddressIfPresent()
		}

		await this.resolveOpenFulfillmentModal(fulfillment)

		if (fulfillment.toLowerCase() === 'delivery') {
			await this.fillDeliveryAddressIfPresent()
		}

		await this.waitForFulfillmentReady(fulfillment)
	}

	private getAddableProductCards(usage: TestUsageType = 'recreational') {
		let products = this.page.locator('li.product').filter({ hasNotText: /Sold Out/i })

		if (!isMedicalUsage(usage)) {
			products = products.filter({
				hasNot: this.page.locator(
					'span.medOnly, .medOnly, .med-metabadge, .wpse-metabadge.med-metabadge',
				),
			})
		}

		return products
	}

	private async readProductCandidate(
		products: Locator,
		menuIndex: number,
	): Promise<StorefrontProductCandidate | null> {
		const productCard = products.nth(menuIndex)
		const isVisible = await productCard.isVisible().catch(() => false)

		if (!isVisible) {
			return null
		}

		const addToCartButton = productCard.locator(storefrontAddToCartSelector).first()
		const hasAddButton = await addToCartButton.isVisible().catch(() => false)

		if (!hasAddButton) {
			return null
		}

		const priceLocators = productCard.locator('.price, .woocommerce-Price-amount, bdi')
		const priceCount = await priceLocators.count()
		const parsedPrices: number[] = []

		for (let index = 0; index < priceCount; index += 1) {
			const priceLocator = priceLocators.nth(index)
			const isPriceVisible = await priceLocator.isVisible().catch(() => false)

			if (!isPriceVisible) {
				continue
			}

			const parsedPrice = this.parseMoney((await priceLocator.textContent()) || '')

			if (parsedPrice !== null && parsedPrice > 0) {
				parsedPrices.push(parsedPrice)
			}
		}

		if (parsedPrices.length === 0) {
			return null
		}

		const name = (
			(await productCard
				.locator('.woocommerce-loop-product__title, h2, h3, a')
				.first()
				.textContent()
				.catch(() => '')) || `Product at menu index ${menuIndex}`
		)
			.replace(/\s+/g, ' ')
			.trim()
		const sku = await addToCartButton.getAttribute('data-product_sku').catch(() => null)

		return {
			menuIndex,
			name,
			price: Math.min(...parsedPrices),
			sku,
		}
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

	private async waitForAddToCartResult(productName: string) {
		const cartDrawer = this.page.locator('#cartDrawer')
		const cartDrawerItem = cartDrawer.locator('.cart_item, .woocommerce-cart-form__cart-item').first()
		const cartDrawerProduct = cartDrawer.getByText(productName, { exact: false }).first()
		const cartCount = this.page.locator('.wpse-cart-count, .cart-count, .rsp-countdown-content').first()
		const addNotice = this.page
			.locator('.woocommerce-message, .wc-block-components-notice-banner, .wpse-snacktoast')
			.filter({ hasText: /added|cart|bag/i })
			.first()

		const added = await Promise.race([
			cartDrawer.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false),
			cartDrawerItem.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false),
			cartDrawerProduct.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false),
			cartCount.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false),
			addNotice.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false),
		])

		if (!added) {
			throw new Error(
				[
					`No add-to-cart confirmation appeared after clicking "${productName}".`,
					`Current URL: ${this.page.url()}`,
					`Cart drawer visible: ${await cartDrawer.isVisible().catch(() => false)}`,
					`Cart drawer item visible: ${await cartDrawerItem.isVisible().catch(() => false)}`,
					`Body preview: ${await this.getBodyPreview()}`,
				].join('\n'),
			)
		}
	}

	async openStorefrontForFulfillment(fulfillment: ShopFulfillment) {
		await test.step(`Open storefront for ${fulfillment}`, async () => {
			await this.page.goto('/')
			await this.page.waitForLoadState('networkidle').catch(() => {})
			await this.ensureFulfillmentSelected(fulfillment)
		})
	}

	async clearStorefrontCart() {
		await test.step('Clear storefront cart', async () => {
			await this.goToCart()

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

	async getAddableStorefrontProducts(
		usage: TestUsageType = 'recreational',
	): Promise<StorefrontProductCandidate[]> {
		return test.step('Inspect addable storefront products', async () => {
			await this.page.waitForSelector('li.product', { timeout: 10000 })
			const products = this.getAddableProductCards(usage)
			const productCount = await products.count()
			const candidates: StorefrontProductCandidate[] = []

			for (let index = 0; index < productCount; index += 1) {
				const candidate = await this.readProductCandidate(products, index)

				if (candidate) {
					candidates.push(candidate)
				}
			}

			return candidates
		})
	}

	async addStorefrontProduct(candidate: StorefrontProductCandidate, usage: TestUsageType = 'recreational') {
		await test.step(`Add storefront product "${candidate.name}"`, async () => {
			const products = this.getAddableProductCards(usage)
			const productCard = products.nth(candidate.menuIndex)
			await expect(productCard, `Expected product "${candidate.name}" to be addable`).toBeVisible()

			const addToCartButton = productCard.locator(storefrontAddToCartSelector).first()
			await expect(
				addToCartButton,
				`Expected product "${candidate.name}" to have an add-to-cart control`,
			).toBeVisible()
			await addToCartButton.scrollIntoViewIfNeeded()
			await addToCartButton.click({ force: true })
			await this.acceptCartConflictIfPresent()
			await this.waitForAddToCartResult(candidate.name)
			await this.closeCartDrawerIfPresent()
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

			const subtotalAmounts = this.page.locator(
				'.cart_item .product-subtotal .amount, .cart_item .product-subtotal bdi',
			)
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

	async getMinimumOrderBannerState(): Promise<MinimumOrderBannerState> {
		return test.step('Inspect minimum-order banner', async () => {
			const notices = this.page.locator(minimumOrderNoticeSelector)
			const noticeCount = await notices.count()

			for (let index = 0; index < noticeCount; index += 1) {
				const notice = notices.nth(index)
				const isVisible = await notice.isVisible().catch(() => false)

				if (!isVisible) {
					continue
				}

				const text = ((await notice.textContent()) || '').replace(/\s+/g, ' ').trim()

				if (text && this.hasMinimumOrderBlockText(text)) {
					return {
						isVisible: true,
						text,
						remainingAmount: this.parseMinimumOrderRemainingAmount(text),
					}
				}
			}

			const bodyText = (await this.getBodyText()).replace(/\s+/g, ' ').trim()

			if (this.hasMinimumOrderBlockText(bodyText)) {
				const minimumOrderMatch = bodyText.match(
					/(order minimum (?:is )?not met|add\s+\$?\d+(?:\.\d+)?\s+to check out)/i,
				)
				const text = minimumOrderMatch ? minimumOrderMatch[0] : bodyText.slice(0, 300)

				return {
					isVisible: true,
					text,
					remainingAmount: this.parseMinimumOrderRemainingAmount(text),
				}
			}

			return {
				isVisible: false,
				text: null,
				remainingAmount: null,
			}
		})
	}

	async getStorefrontCheckoutState(): Promise<StorefrontCheckoutState> {
		return test.step('Inspect storefront checkout state', async () => {
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
			const isVisible = await checkoutButton.isVisible().catch(() => false)
			let isDisabledByDom = false

			if (isVisible) {
				isDisabledByDom = await checkoutButton
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
			}

			const isEnabled = isVisible && !isDisabledByDom && (await checkoutButton.isEnabled().catch(() => false))

			return {
				isVisible,
				isEnabled,
				isReachable: isVisible && isEnabled,
				url: this.page.url(),
			}
		})
	}

	private async waitForCartLoaded(options: GoToCartOptions = {}) {
		const deadline = Date.now() + 30_000
		let lastState: CartLoadState | null = null

		while (Date.now() < deadline) {
			lastState = await this.getCartLoadState()

			if (options.requireItems) {
				if (lastState.hasCartItem || lastState.hasCheckoutButton) {
					return
				}
			} else if (
				lastState.hasCartItem ||
				lastState.hasCheckoutButton ||
				lastState.hasCartTitle ||
				lastState.hasEmptyCartText
			) {
				return
			}

			await this.page.waitForTimeout(500)
		}

		const bodyText = await this.page
			.locator('body')
			.innerText({ timeout: 1000 })
			.catch(() => '')
		const bodyPreview = bodyText.replace(/\s+/g, ' ').trim().slice(0, 500)

		throw new Error(
			[
				`Cart page did not load within 30000ms after navigating to ${this.getCartPath()}.`,
				`Current URL: ${lastState?.url || this.page.url()}`,
				`Cart item visible: ${lastState?.hasCartItem ?? false}`,
				`Checkout button visible: ${lastState?.hasCheckoutButton ?? false}`,
				`Cart title visible: ${lastState?.hasCartTitle ?? false}`,
				`Empty cart text visible: ${lastState?.hasEmptyCartText ?? false}`,
				`Body preview: ${bodyPreview}`,
			].join('\n'),
		)
	}

	async addProductsToCart(
		itemCount: number,
		mobile = false,
		fulfillment = 'Delivery',
		usage: TestUsageType = 'recreational',
	) {
		await test.step('Navigate to Shop page', async () => {
			await this.page.waitForTimeout(3000)
			await this.page.goto('/')
			await this.page.waitForTimeout(3000)
		})
		await test.step('Select Fulfillment Method', async () => {
			await this.ensureFulfillmentSelected(fulfillment)
		})
		await test.step('Add Products to Cart', async () => {
			itemCount = itemCount + (await this.randomizeCartItems())
			await this.page.waitForSelector(storefrontAddToCartSelector)
			const products = this.getAddableProductCards(usage)

			for (let i = 0; i < itemCount; i++) {
				await test.step(`Add Products # ${i + 1}`, async () => {
					await expect(products.nth(i)).toBeVisible({ timeout: 5000 })
					var productCard = products.nth(i)
					var productName = (
						(await productCard
							.locator('.woocommerce-loop-product__title, h2, h3, a')
							.first()
							.textContent()
							.catch(() => '')) || `Product #${i + 1}`
					)
						.replace(/\s+/g, ' ')
						.trim()
					var addToCartButton = productCard.locator(storefrontAddToCartSelector).first()
					await addToCartButton.click({ force: true })
					await this.waitForAddToCartResult(productName)
					await this.closeCartDrawerIfPresent()
				})
			}
			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			await this.goToCart({ requireItems: true })
		})
	}
	async addSameProductToCart(itemCount: number) {
		await test.step('Add Products to Cart', async () => {
			await this.page.waitForSelector('[aria-label*="Add to cart:"]')

			const addToCartButtons = await this.page
				.locator('[aria-label*="Add to cart:"]')
				.elementHandles()

			for (let i = 0; i < itemCount; i++) {
				await addToCartButtons[0].click()
				await this.page.waitForTimeout(750)
			}
			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			await this.page.locator(``).first().click({ force: true })
		})
	}
	async addProductListToCart(orderList: string[]) {
		for (let index = 0; index < orderList.length; index++) {
			await test.step(`Add ${orderList[index]} to Cart`, async () => {
				await this.page
					.locator(`[data-product_sku*='${orderList[index]}']`)
					.first()
					.scrollIntoViewIfNeeded()
				await this.page.locator(`[data-product_sku*='${orderList[index]}']`).first().click()
				await this.page.waitForTimeout(2000)
			})
		}
		await this.page.waitForTimeout(5000)
	}
	async goToCart(options: GoToCartOptions = {}) {
		await test.step('Navigate to Cart', async () => {
			await this.page.goto(this.getCartPath())
			await this.waitForCartLoaded(options)
		})
	}

	async addProductsToCartPickup(
		itemCount: number,
		mobile = false,
		fulfillment = 'Pickup',
		usage: TestUsageType = 'recreational',
	) {
		await test.step('Navigate to Shop page', async () => {
			await this.page.waitForTimeout(3000)
			await this.page.goto('/')
			await this.page.waitForTimeout(3000)
		})
		await test.step('Select Fulfillment Method', async () => {
			await this.ensureFulfillmentSelected(fulfillment)
		})
		await test.step('Add Products to Cart', async () => {
			itemCount = itemCount + (await this.randomizeCartItems())
			await this.page.waitForSelector(storefrontAddToCartSelector)
			const products = this.getAddableProductCards(usage)

			for (let i = 0; i < itemCount; i++) {
				await test.step(`Add Products # ${i + 1}`, async () => {
					await expect(products.nth(i)).toBeVisible({ timeout: 5000 })
					var productCard = products.nth(i)
					var productName = (
						(await productCard
							.locator('.woocommerce-loop-product__title, h2, h3, a')
							.first()
							.textContent()
							.catch(() => '')) || `Product #${i + 1}`
					)
						.replace(/\s+/g, ' ')
						.trim()
					var addToCartButton = productCard.locator(storefrontAddToCartSelector).first()
					await addToCartButton.click({ force: true })
					await this.waitForAddToCartResult(productName)
					await this.closeCartDrawerIfPresent()
				})
			}

			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			await this.goToCart({ requireItems: true })
		})
	}
}
