import test, { expect, Locator, Page, request } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'

import zipcodes from '../utils/zipcodes.json'

export class CheckoutPage {
	readonly page: Page
	readonly firstNameInput: Locator
	readonly lastNameInput: Locator
	readonly phoneInput: Locator
	readonly addressLine1: Locator
	readonly city: Locator
	readonly zipCodeInput: Locator
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

	constructor(page: Page) {
		this.page = page
		this.firstNameInput = this.page.locator('input[name="billing_first_name"]')
		this.lastNameInput = this.page.locator('input[name="billing_last_name"]')
		this.phoneInput = this.page.locator('input[name="billing_phone"]')
		this.addressLine1 = this.page.locator('input[name="billing_address_1"]')
		this.city = this.page.locator('input[name="billing_city"]')
		this.zipCodeInput = this.page.locator('input[name="billing_postcode"]')
		this.comments = this.page.locator('textarea[name="order_comments"]')
		this.placeOrderButton = this.page.locator('text=Place order')
		this.cartItems = new Array()
	}

	async verifyCheckoutTotals(zipcode: string, usageType: number, productList: any[]): Promise<any> {
		this.cartItems = []
		const apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
		await test.step('GET Tax Rates + Product Info', async () => {
			await test.step('GET Tax Rate', async () => {
				//Get Tax Rates
				console.log(zipcode)

				const taxRateResponse = await apiContext.get(
					`/wp-content/plugins/seventen-testing-api/api/rates/?postCode=${zipcode}`,
				)
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
		await test.step('Fill in First Name', async () => {
			await this.page.waitForTimeout(3000)
			await this.firstNameInput.click()
			await this.firstNameInput.fill(firstName)
		})

		await test.step('Fill in Last Name', async () => {
			await this.lastNameInput.click()
			await this.lastNameInput.fill(lastName)
		})

		await test.step('Fill in Street Address', async () => {
			await this.addressLine1.click()
			await this.addressLine1.fill(faker.address.streetAddress())
		})

		await test.step('Fill in State', async () => {
			await this.city.click()
			await this.city.fill(faker.address.cityName())
		})

		await test.step('Fill in ZipCode', async () => {
			await this.zipCodeInput.click()
			await this.zipCodeInput.fill(zipcode)
		})

		await test.step('Fill in Phone Number', async () => {
			await this.phoneInput.click()
			await this.phoneInput.fill('123-456-7890')
		})

		await test.step('Fill in Order Notes', async () => {
			await this.comments.click()
			await this.comments.fill(faker.random.words(30))
		})

		if (singleZip === false) {
			for (let i = 0; i < this.zipcodes.length; i++) {
				await test.step(`Verify Order Total for ${this.zipcodes[i]}`, async () => {
					await this.zipCodeInput.click()
					await this.zipCodeInput.fill(this.zipcodes[i])
					await this.zipCodeInput.press('Enter')
					await this.page.waitForTimeout(1000)
					cartTotals = await this.verifyCheckoutTotals(this.zipcodes[i], usageType, productList)
				})
			}
		} else {
			cartTotals = await this.verifyCheckoutTotals(zipcode, usageType, productList)
		}

		await test.step('Submit New Customer Order', async () => {
			await this.placeOrderButton.click()
		})

		return cartTotals
	}
}
