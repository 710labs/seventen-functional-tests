import test, { Page, TestInfo, Locator, expect, request, APIRequestContext } from '@playwright/test'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'

export class CartPage {
	page: Page
	browserName: any
	workerInfo: TestInfo
	checkoutButton: Locator
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
		this.checkoutButton = this.page.locator('text=Proceed')
		this.cartItems = new Array()
		this.usageType = usageType
		this.apiContext = apiContext
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

			const taxRateResponse = await this.apiContext.get(`rates/?postCode=${zipcode}`)
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
}
