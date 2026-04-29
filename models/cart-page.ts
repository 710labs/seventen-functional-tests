import test, { Page, TestInfo, Locator, expect } from '@playwright/test'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'
import { QAClient } from '../support/qa/client'
import { type TestUsageType } from '../utils/usage-types'

export class CartPage {
	page: Page
	browserName: any
	workerInfo: TestInfo
	checkoutButton: Locator
	cartItems: any[]
	cartTotal: any
	usageType: TestUsageType
	qaClient: QAClient
	cartCounter:Locator

	constructor(
		page: Page,
		qaClient: QAClient,
		browserName: any,
		workerInfo: TestInfo,
		usageType: TestUsageType,
	) {
		this.page = page
		this.browserName = browserName
		this.workerInfo = workerInfo
		this.checkoutButton = this.page.locator('.checkout-button')
		this.cartItems = new Array()
		this.usageType = usageType
		this.qaClient = qaClient
		this.cartCounter = this.page.locator('.rsp-countdown-content')
	}

	async goToCheckout() {
		await test.step('Proceed to Checkout', async () => {
			await this.checkoutButton.click()
		})
	}

	async verifyCart(zipcode: string): Promise<any> {
		if (process.env.BYPASS_TAX_CALC === 'true') {
			await test.step('Proceed to Checkout', async () => {
				await this.checkoutButton.click()
			})
			return this.cartItems
		}

		await test.step('Verify Cart Totals', async () => {
			//Get Tax Rates
			var taxRates: any

			taxRates = await this.qaClient.getRates({ post_code: zipcode })

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

				const product = await this.qaClient.getProduct({ product_id: productId || undefined })

				var id = product.id
				var sku = product.sku
				var taxClass = product.tax_class
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
			await this.checkoutButton.click()
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
