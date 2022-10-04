import test, { APIRequestContext, expect, Locator, Page, request } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'

import zipcodes from '../utils/zipcodes-ca.json'

export class CheckoutPage {
	readonly page: Page
	readonly firstNameInput: Locator
	readonly lastNameInput: Locator
	readonly phoneInput: Locator
	readonly addressLine1: Locator
	readonly city: Locator
	readonly zipCodeInput: Locator
	readonly addressModifierButton: Locator
	readonly addressModifierSubmitButton: Locator
	readonly comments: Locator
	readonly subTotal: Locator
	readonly grossTaxAmount: Locator
	readonly exciseTaxAmount: Locator
	readonly salesTaxAmount: Locator
	readonly cartTotalAmount: Locator
	readonly placeOrderButton: Locator
	cartItems: any
	usageType: number
	cartTotal: {
		cartSubTotal: string
		grossTaxAmount: string
		exciseTaxAmount: string
		salesTaxAmount: string
		total: string
	}
	checkoutButton: any
	taxRates: any
	zipcodes = zipcodes
	apiContext: APIRequestContext

	constructor(page: Page, apiContext: APIRequestContext) {
		this.page = page
		this.firstNameInput = this.page.locator('input[name="billing_first_name"]')
		this.lastNameInput = this.page.locator('input[name="billing_last_name"]')
		this.phoneInput = this.page.locator('input[name="billing_phone"]')
		this.addressLine1 = this.page.locator('input[name="billing_address_1"]')
		this.addressModifierButton = this.page.locator('[data-modder="address"]')
		this.addressModifierSubmitButton = this.page.locator('a > [data-mod="address"]')
		this.city = this.page.locator('input[name="billing_city"]')
		this.zipCodeInput = this.page.locator('input[name="billing_postcode"]')
		this.comments = this.page.locator('textarea[name="order_comments"]')
		this.placeOrderButton = this.page.locator('id=place_order')
		this.cartItems = new Array()
		this.apiContext = apiContext
	}

	async verifyCheckoutTotals(zipcode: string, usageType: number, productList: any[]): Promise<any> {
		if (process.env.BYPASS_TAX_CALC === 'true') {
			return this.cartTotal
		}

		this.cartItems = []
		await test.step('GET Tax Rates + Product Info', async () => {
			await test.step('GET Tax Rate', async () => {
				//Get Tax Rates
				console.log(zipcode)

				const taxRateResponse = await this.apiContext.get(`rates/?postCode=${zipcode}`)
				const taxRateResponseBody: any = await taxRateResponse.json()

				this.taxRates = taxRateResponseBody
			})
			await test.step('GET Actual Order Totals', async () => {
				//Get CartTotal object (actual cart)
				await this.page.waitForSelector('.shop_table')
				var cartSubTotal = await (
					await this.page.$('.shop_table >> .cart-subtotal >> bdi')
				).innerHTML()
				cartSubTotal = await formatNumbers(cartSubTotal)
				if (usageType === 0) {
					await test.step('GET Recreational Tax Totals', async () => {
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
						var total = await (
							await this.page.$('.shop_table >> .order-total >> .amount')
						).innerHTML()
						total = await formatNumbers(total)

						this.cartTotal = {
							cartSubTotal,
							grossTaxAmount,
							exciseTaxAmount,
							salesTaxAmount,
							total,
						}
						console.log(this.cartTotal)
					})
				} else {
					await test.step('GET Medical Tax Totals', async () => {
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
						var total = await (
							await this.page.$('.shop_table >> .order-total >> .amount')
						).innerHTML()
						total = await formatNumbers(total)

						this.cartTotal = {
							cartSubTotal,
							grossTaxAmount,
							exciseTaxAmount,
							salesTaxAmount,
							total,
						}
						console.log(this.cartTotal)
					})
				}

				var expectedCartTotal = await calculateCartTotals(
					this.taxRates,
					productList,
					this.usageType,
				)
				await expect(parseFloat(this.cartTotal.total)).toBeCloseTo(
					parseFloat(expectedCartTotal.expectedTotal),
					1,
				)
			})
		})
		return this.cartTotal
	}
	async confirmCheckout(
		zipcode: string,
		productList: any,
		usageType: number,
		singleZip: boolean = false,
		address: string = '9779 Oak Pass Rd',
	): Promise<any> {
		const firstName = faker.name.firstName()
		const lastName = faker.name.lastName()

		let cartTotals
		await test.step('Verify Layout', async () => {
			await expect(this.page.locator('.site-info > span > a')).toHaveAttribute(
				'href',
				'/terms-of-use',
			)
			await expect(this.page.locator('.site-info > a')).toHaveAttribute('href', '/privacy-policy')
		})

		if (singleZip === false) {
			for (let i = 0; i < this.zipcodes.length; i++) {
				await test.step(`Verify Order Total for ${this.zipcodes[i]}`, async () => {
					await this.addressModifierButton.click()
					await this.zipCodeInput.click()
					await this.zipCodeInput.fill(this.zipcodes[i])
					await this.page.locator('text=Submit >> nth=0').click()
					await this.page.waitForTimeout(1000)
					cartTotals = await this.verifyCheckoutTotals(this.zipcodes[i], usageType, productList)
				})
			}
		} else {
			cartTotals = await this.verifyCheckoutTotals(zipcode, usageType, productList)
		}

		await test.step('Select Acuity Slot', async () => {
			await this.page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first().click()
		})

		await test.step('Submit New Customer Order', async () => {
			await this.placeOrderButton.click()
		})

		return cartTotals
	}
}
