import test, { Page, TestInfo, Locator, expect, request, APIRequestContext } from '@playwright/test'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'

export class CartPage {
	page: Page
	browserName: any
	workerInfo: TestInfo
	checkoutButton: Locator
	reservationTimer: Locator
	productName: Locator
	productImage: Locator
	productImage2: Locator
	cartItems: any[]
	cartTotal: any
	usageType: any
	apiContext: APIRequestContext

	constructor(
		page: Page,
		apiContext: APIRequestContext,
		browserName: any,
		workerInfo: TestInfo,
		usageType,
	) {
		this.page = page
		this.browserName = browserName
		this.workerInfo = workerInfo
		this.checkoutButton = this.page.locator('.checkout-button')
		this.reservationTimer = this.page.locator('.rsp-countdown-content')
		this.productName = this.page.locator('td.product-name')
		this.productImage = this.page.locator('img.woocommerce-placeholder.wp-post-image')
		this.productImage2 = this.page.locator('img.attachment-woocommerce_thumbnail.size-woocommerce_thumbnail')
		this.cartItems = new Array()
		this.usageType = usageType
		this.apiContext = apiContext
	}

	async goToCheckout() {
		await test.step('Proceed to Checkout', async () => {
			this.checkoutButton.click()
		})
	}

	async verifyCart(zipcode: string): Promise<any> {
		if (process.env.BYPASS_TAX_CALC === 'true') {
			await test.step('Proceed to Checkout', async () => {
				this.checkoutButton.click()
			})
			return this.cartItems
		}

		await test.step('Verify Cart Totals', async () => {
			//Get Tax Rates
			var taxRates: any

			const taxRateResponse = await this.apiContext.get(`rates?postCode=${zipcode}`)
			const taxRateResponseBody: any = await taxRateResponse.json()

			taxRates = taxRateResponseBody

			//Get ProductItem Info
			await this.page.waitForSelector('.cart_item')

			const productRows = await this.page.locator('.cart_item').elementHandles()
			await expect(productRows, 'Could not find any products in cart').not.toBeNull()

			for (let i = 0; i < productRows.length; i++) {
				var unitPrice = await (await productRows[i].$('.product-price >> bdi')).innerHTML()
				unitPrice = await formatNumbers(unitPrice)
				if (unitPrice == '0.00') {
					continue
				}
				var quanity = await (await productRows[i].$('.qty')).inputValue()
				var amount = await formatNumbers(
					await (await productRows[i].$('.product-subtotal >> bdi')).innerHTML(),
				)
				var name = await (await productRows[i].$('.product-name >> a')).innerHTML()
				name = name.replace(/\#/g, '%23')
				name = name.replace(/\+/g, '%2B')

				var idElement = await productRows[i].$('.product-remove >> a')

				var productId = await idElement.getAttribute('data-product_id')

				const productInfoResponse = await this.apiContext.get(`products/?productId=${productId}`)
				const productInfoResponseBody: any = await productInfoResponse.json()

				var id = productInfoResponseBody.product.id
				var sku = productInfoResponseBody.product.sku
				var taxClass = productInfoResponseBody.product.taxClass
				this.cartItems.push({
					id,
					name,
					sku,
					unitPrice,
					taxClass,
					quanity,
					subTotal: amount,
				})
			}
		})
		await test.step('Confirm Cart + Proceed to Checkout', async () => {
			this.checkoutButton.click()
		})
		await expect(this.cartItems).not.toBeNull

		return this.cartItems
	}

	async verifyCredit(existingAccountCredit: number): Promise<any> {
		var accountCredit: string = ''
		await test.step('Verify Cart Summary', async () => {
			//Get Cart Summary Info
			const taxSummaries = await this.page.locator('.tax-rate').elementHandles()
			const accountCreditElement = await this.page.locator('.cart-discount').elementHandle()
			accountCredit = await formatNumbers(
				await (await accountCreditElement.$('.amount')).innerHTML(),
			)

			await expect(accountCredit, 'Account Credit was not applied to order.').not.toBeNull()
			await expect(
				taxSummaries,
				'Taxes not applied to order with Account Credit applied.',
			).not.toBeNull()
			await expect(
				Math.floor(accountCredit),
				'Credit amount applied to cart is higher than client credit on account.',
			).toBeLessThanOrEqual(existingAccountCredit)
		})
	}
}
