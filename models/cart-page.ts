import test, { Page, TestInfo, Locator, expect, request } from '@playwright/test'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'

export class CartPage {
	page: Page
	browserName: any
	workerInfo: TestInfo
	checkoutButton: Locator
	cartItems: any[]
	cartTotal: any
	usageType: any

	constructor(page: Page, browserName: any, workerInfo: TestInfo, usageType) {
		this.page = page
		this.browserName = browserName
		this.workerInfo = workerInfo
		this.checkoutButton = this.page.locator('text=Proceed to checkout')
		this.cartItems = new Array()
		this.usageType = usageType
	}

	async verifyCart(zipcode: string): Promise<any> {
		const apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})

		await test.step('Verify Cart Totals', async () => {
			//Get Tax Rates
			var taxRates: any

			const taxRateResponse = await apiContext.get(
				`/wp-content/plugins/seventen-testing-api/api/rates/?postCode=${zipcode}`,
			)
			const taxRateResponseBody: any = await taxRateResponse.json()

			taxRates = taxRateResponseBody

			//Get ProductItem Info
			await this.page.waitForSelector('.cart_item')

			const productRows = await this.page.locator('.cart_item').elementHandles()

			for (let i = 0; i < productRows.length; i++) {
				var unitPrice = await (await productRows[i].$('.product-price >> bdi')).innerHTML()
				unitPrice = await formatNumbers(unitPrice)
				var quanity = await (await productRows[i].$('.qty')).inputValue()
				var amount = await formatNumbers(
					await (await productRows[i].$('.product-subtotal >> bdi')).innerHTML(),
				)
				var name = await (await productRows[i].$('.product-name >> a')).innerHTML()
				name = name.replace(/\#/g, '%23')
				name = name.replace(/\+/g, '%2B')
				
				var idElement = await productRows[i].$('.product-remove >> a')

				var productId = await idElement.getAttribute('data-product_id')

				const productInfoResponse = await apiContext.get(
					`/wp-content/plugins/seventen-testing-api/api/products/?productId=${productId}`,
				)
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
			//Get CartTotal object (actual cart)
			await this.page.waitForSelector('.shop_table')
			var cartSubTotal = await (
				await this.page.$('.shop_table >> .cart-subtotal >> bdi')
			).innerHTML()
			cartSubTotal = await formatNumbers(cartSubTotal)
			if (this.usageType === 0) {
				var grossTaxAmount = await (
					await this.page.$('.tax-rate-us-ca-county-gross-tax-1 >> .amount')
				).innerHTML()
				grossTaxAmount = await formatNumbers(grossTaxAmount)

				var exciseTaxAmount = await (
					await this.page.$('.tax-rate-us-ca-california-excise-tax-2 >> .amount')
				).innerHTML()
				exciseTaxAmount = await formatNumbers(exciseTaxAmount)

				var salesTaxAmount = await (
					await this.page.$('.tax-rate-us-ca-sales-3 >> .amount')
				).innerHTML()
				salesTaxAmount = await formatNumbers(salesTaxAmount)
			} else {
				var grossTaxAmount = await (
					await this.page.$('.tax-rate-us-ca-gross-1 >> .amount')
				).innerHTML()
				grossTaxAmount = await formatNumbers(grossTaxAmount)

				var exciseTaxAmount = await (
					await this.page.$('.tax-rate-us-ca-excise-2 >> .amount')
				).innerHTML()
				exciseTaxAmount = await formatNumbers(exciseTaxAmount)

				var salesTaxAmount = await (
					await this.page.$('.tax-rate-us-ca-sales-3 >> .amount')
				).innerHTML()
				salesTaxAmount = await formatNumbers(salesTaxAmount)
			}

			var total = await (await this.page.$('.shop_table >> .order-total >> .amount')).innerHTML()
			total = await formatNumbers(total)

			this.cartTotal = {
				cartSubTotal,
				grossTaxAmount,
				exciseTaxAmount,
				salesTaxAmount,
				total,
			}
			console.log(this.cartTotal)

			var expectedCartTotal = await calculateCartTotals(taxRates, this.cartItems, this.usageType)
			await expect(parseFloat(this.cartTotal.total)).toBeCloseTo(
				parseFloat(expectedCartTotal.expectedTotal),
				1,
			)
		})
		await test.step('Confirm Cart + Proceed to Checkout', async () => {
			this.checkoutButton.click()
		})
		return this.cartItems
	}
}
