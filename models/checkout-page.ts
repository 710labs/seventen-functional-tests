import test, { APIRequestContext, expect, Locator, Page, request } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'

import zipcodes from '../utils/zipcodes-ca.json'
import zipcodesCO from '../utils/zipcodes-co.json'
import { fictionalAreacodes } from '../utils/data-generator'

export class CheckoutPage {
	readonly page: Page
	readonly firstNameInput: Locator
	readonly lastNameInput: Locator
	readonly phoneInput: Locator
	readonly addressLine1: Locator
	readonly city: Locator
	readonly zipCodeInput: Locator
	readonly addressModifierButton: Locator
	readonly addressModifierWindow: Locator
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
	zipcodesCO = zipcodesCO
	apiContext: APIRequestContext

	constructor(page: Page, apiContext: APIRequestContext) {
		this.page = page
		this.firstNameInput = this.page.locator('input[name="billing_first_name"]')
		this.lastNameInput = this.page.locator('input[name="billing_last_name"]')
		this.phoneInput = this.page.locator('input[name="billing_phone"]')
		this.addressLine1 = this.page.locator('input[name="billing_address_1"]')
		this.addressModifierButton = this.page.locator('a.wcse-mod-link[data-modder="address"]')
		this.addressModifierWindow = this.page.locator('.woocommerce-billing-fields')
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
				const taxRateResponse = await this.apiContext.get(`rates?postCode=${zipcode}`)
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
					})
				} else {
					await test.step('GET Medical Tax Totals', async () => {
						var grossTaxAmount = await (
							await this.page.$('.tax-rate >> nth=0 >> .amount')
						).innerHTML()
						grossTaxAmount = await formatNumbers(grossTaxAmount)

						var exciseTaxAmount = await (
							await this.page.$('.tax-rate >> nth=1 >> .amount')
						).innerHTML()
						exciseTaxAmount = await formatNumbers(exciseTaxAmount)

						var salesTaxAmount = await (
							await this.page.$('.tax-rate >> nth=2 >> .amount')
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
					await this.addressModifierButton.click({ force: true })
					await this.page.waitForTimeout(5000)
					await this.zipCodeInput.waitFor({ state: 'visible' });
					await this.zipCodeInput.scrollIntoViewIfNeeded();
					await this.zipCodeInput.click();
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

		await test.step(`Select Acuity Slot for ${zipcode} `, async () => {
			var daySlot = await this.page.locator('#svntnAcuityDayChoices >> .acuityChoice').first()
			await expect(
				daySlot,
				'Could not find Acuity Day Slot Selector. Check Acuity Slots status.',
			).toBeVisible()
			await daySlot.click()

			var timeSlot = await this.page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first()
			await expect(
				timeSlot,
				'Could not find Acuity Time Slot Selector. Check Acuity Slots status.',
			).toBeVisible()
			await timeSlot.click()
		})

		await test.step('Submit New Customer Order', async () => {
			await this.placeOrderButton.click()
		})

		return cartTotals
	}

	async selectSlot() {
		await test.step(`Select Acuity Slot`, async () => {
			await this.page.waitForSelector('#svntnAcuityDayChoices >> .acuityChoice', {
				timeout: 45 * 1000,
			})

			var daySlot = await this.page.locator('#svntnAcuityDayChoices >> .acuityChoice').first()
			await expect(
				daySlot,
				'Could not find Acuity Day Slot Selector. Check Acuity Slots status.',
			).toBeVisible()
			await daySlot.click()

			await this.page.waitForSelector('#svntnAcuityTimeChoices >> .acuityChoice')

			var timeSlot = await this.page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first()
			await expect(
				timeSlot,
				'Could not find Acuity Time Slot Selector. Check Acuity Slots status.',
			).toBeVisible()
			await timeSlot.click()
		})
	}

	async confirmCheckoutDeprecated(
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
			await this.phoneInput.fill(
				faker.phone.phoneNumber(`${faker.helpers.arrayElement(fictionalAreacodes)}-###-####`),
			)
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

	async confirmCheckoutColorado(
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
			for (let i = 0; i < this.zipcodesCO.length; i++) {
				await test.step(`Verify Order Total for ${this.zipcodesCO[i]}`, async () => {
					await this.addressModifierButton.click()
					await this.zipCodeInput.click()
					await this.zipCodeInput.fill(this.zipcodesCO[i])
					await this.page.locator('text=Submit >> nth=0').click()
					await this.page.waitForTimeout(1000)
					cartTotals = await this.verifyCheckoutTotals(this.zipcodesCO[i], usageType, productList)
				})
			}
		} else {
			cartTotals = await this.verifyCheckoutTotals(zipcodesCO, usageType, productList)
		}

		await test.step(`Select Acuity Slot for ${zipcodesCO} `, async () => {
			var daySlot = await this.page.locator('#svntnAcuityDayChoices >> .acuityChoice').first()
			await expect(
				daySlot,
				'Could not find Acuity Day Slot Selector. Check Acuity Slots status.',
			).toBeVisible()
			await daySlot.click()

			var timeSlot = await this.page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first()
			await expect(
				timeSlot,
				'Could not find Acuity Time Slot Selector. Check Acuity Slots status.',
			).toBeVisible()
			await timeSlot.click()
		})

		await test.step('Submit New Customer Order', async () => {
			await this.placeOrderButton.click()
		})

		return cartTotals
	}
}
