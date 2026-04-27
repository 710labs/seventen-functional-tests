import test, { expect, Locator, Page } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'
import { QAClient } from '../support/qa/client'
import { assertFooterLinks } from '../utils/footer-links'
import { isMedicalUsage, type TestUsageType } from '../utils/usage-types'

import zipcodes from '../utils/zipcodes-ca.json'
import zipcodesCO from '../utils/zipcodes-co.json'
import { fictionalAreacodes } from '../utils/data-generator'

type CheckoutRefreshDiagnostics = {
	submittedZipcode: string
	postcode: string | null
	billingPostcode: string | null
	fulfillmentType: string | null
	shippingMethod: string | null
	deliveryAvailable: boolean | null
	pickupAvailable: boolean | null
	deliveryZoneId: string | null
	pickupFacilityId: string | null
}

type CheckoutTotals = {
	cartSubTotal: string
	grossTaxAmount: string
	exciseTaxAmount: string
	salesTaxAmount: string
	total: string
}

type CheckoutTaxSnapshot = CheckoutTotals & {
	rows: Record<string, string>
	calculatedTotal: string
}

export class CheckoutPage {
	private readonly checkoutReviewTimeoutMs = 45_000
	private readonly checkoutSummaryStabilityPollMs = 250
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
	cartTotal: {
		cartSubTotal: string
		grossTaxAmount: string
		exciseTaxAmount: string
		salesTaxAmount: string
		total: string
	}
	checkoutButton: any
	taxRates: any
	lastCheckoutRefreshDiagnostics: CheckoutRefreshDiagnostics | null
	zipcodes = zipcodes
	zipcodesCO = zipcodesCO
	qaClient: QAClient

	constructor(page: Page, qaClient: QAClient) {
		this.page = page
		this.firstNameInput = this.page.locator('input[name="billing_first_name"]')
		this.lastNameInput = this.page.locator('input[name="billing_last_name"]')
		this.phoneInput = this.page.locator('input[name="billing_phone"]')
		this.addressLine1 = this.page.locator('input[name="billing_address_1"]')
		this.addressModifierButton = this.page.locator(
			'a.wcse-mod-link[data-modder="address"]:has-text("Change")',
		)
		this.addressModifierWindow = this.page.locator('.woocommerce-billing-fields')
		this.addressModifierSubmitButton = this.page.locator('a > [data-mod="address"]')
		this.city = this.page.locator('input[name="billing_city"]')
		this.zipCodeInput = this.page.locator('input[name="billing_postcode"]')
		this.comments = this.page.locator('textarea[name="order_comments"]')
		this.placeOrderButton = this.page.locator('id=place_order')
		this.cartItems = new Array()
		this.qaClient = qaClient
		this.lastCheckoutRefreshDiagnostics = null
	}

	private normalizeSummaryLabel(label: string): string {
		return label.replace(/\s+/g, ' ').trim().toLowerCase()
	}

	private parseOrderReviewRequest(postData: string | null): {
		postcode: string | null
		billingPostcode: string | null
		fulfillmentType: string | null
		shippingMethod: string | null
	} {
		const params = new URLSearchParams(postData || '')
		const nestedParams = new URLSearchParams(params.get('post_data') || '')
		const shippingMethod =
			params.get('shipping_method[0]') || nestedParams.get('shipping_method[0]')

		return {
			postcode: params.get('postcode'),
			billingPostcode: nestedParams.get('billing_postcode'),
			fulfillmentType: nestedParams.get('fulfillmentType'),
			shippingMethod,
		}
	}

	private async readJsonResponseBody(response: any): Promise<Record<string, any> | null> {
		try {
			const body = await response.json()
			if (body && typeof body === 'object') {
				return body as Record<string, any>
			}
		} catch {
			return null
		}

		return null
	}

	private async installCheckoutUpdateListener(): Promise<number> {
		return this.page.evaluate(() => {
			const win = window as typeof window & {
				__codexUpdatedCheckoutCount?: number
				__codexUpdatedCheckoutListenerInstalled?: boolean
			}

			win.__codexUpdatedCheckoutCount = win.__codexUpdatedCheckoutCount ?? 0

			if (!win.__codexUpdatedCheckoutListenerInstalled) {
				const increment = () => {
					win.__codexUpdatedCheckoutCount = (win.__codexUpdatedCheckoutCount ?? 0) + 1
				}

				if (typeof (window as any).jQuery === 'function') {
					;(window as any).jQuery(document.body).on('updated_checkout.codex', increment)
				} else {
					document.body.addEventListener('updated_checkout', increment)
				}

				win.__codexUpdatedCheckoutListenerInstalled = true
			}

			return win.__codexUpdatedCheckoutCount
		})
	}

	private async waitForCheckoutReviewUpdate(zipcode: string): Promise<CheckoutRefreshDiagnostics> {
		const previousCheckoutUpdateCount = await this.installCheckoutUpdateListener()
		const addressUpdateResponsePromise = this.page.waitForResponse(
			(response) => {
				const request = response.request()
				const postData = request.postData() || ''

				return (
					request.method() === 'POST' &&
					postData.includes('action=wpse_visitor_mod_submission') &&
					postData.includes(`billing_postcode=${zipcode}`)
				)
			},
			{ timeout: this.checkoutReviewTimeoutMs },
		)
		const orderReviewResponsePromise = this.page.waitForResponse(
			(response) => {
				if (response.request().method() !== 'POST') {
					return false
				}

				if (!response.url().includes('wc-ajax=update_order_review')) {
					return false
				}

				const requestDetails = this.parseOrderReviewRequest(response.request().postData())

				return requestDetails.postcode === zipcode || requestDetails.billingPostcode === zipcode
			},
			{ timeout: this.checkoutReviewTimeoutMs },
		)

		await this.page.locator('text=Submit >> nth=0').click()

		const [addressUpdateResponse, orderReviewResponse] = await Promise.all([
			addressUpdateResponsePromise,
			orderReviewResponsePromise,
		])

		await this.page.waitForFunction(
			(previousCount) =>
				((window as any).__codexUpdatedCheckoutCount || 0) > Number(previousCount || 0),
			previousCheckoutUpdateCount,
			{ timeout: this.checkoutReviewTimeoutMs },
		)
		await this.page.waitForFunction(
			(expectedZipcode) => {
				const postcodeInput = document.querySelector(
					'input[name="billing_postcode"]',
				) as HTMLInputElement | null

				return postcodeInput?.value === expectedZipcode
			},
			zipcode,
			{ timeout: this.checkoutReviewTimeoutMs },
		)
		await this.waitForCheckoutSummaryToStabilize(zipcode)

		const addressUpdateBody = await this.readJsonResponseBody(addressUpdateResponse)
		const orderReviewRequest = this.parseOrderReviewRequest(orderReviewResponse.request().postData())

		return {
			submittedZipcode: zipcode,
			postcode: orderReviewRequest.postcode,
			billingPostcode: orderReviewRequest.billingPostcode,
			fulfillmentType: orderReviewRequest.fulfillmentType,
			shippingMethod: orderReviewRequest.shippingMethod,
			deliveryAvailable:
				typeof addressUpdateBody?.deliveryAvailable === 'boolean'
					? addressUpdateBody.deliveryAvailable
					: null,
			pickupAvailable:
				typeof addressUpdateBody?.pickupAvailable === 'boolean'
					? addressUpdateBody.pickupAvailable
					: null,
			deliveryZoneId: addressUpdateBody?.deliverer?.zoneId?.toString?.() || null,
			pickupFacilityId: addressUpdateBody?.pickuper?.facilityId?.toString?.() || null,
		}
	}

	private async readCheckoutSummaryRows(): Promise<Record<string, string>> {
		const table = this.page.locator('.woocommerce-checkout-review-order-table, .shop_table').first()
		await table.waitFor({ state: 'visible' })

		const rows = table.locator('tfoot tr')
		const rowCount = await rows.count()
		const summaryRows: Record<string, string> = {}

		for (let index = 0; index < rowCount; index++) {
			const row = rows.nth(index)
			const header = row.locator('th')
			const amount = row.locator('td .amount').first()

			if ((await header.count()) === 0 || (await amount.count()) === 0) {
				continue
			}

			const normalizedLabel = this.normalizeSummaryLabel(await header.innerText())
			summaryRows[normalizedLabel] = await formatNumbers(await amount.innerHTML())
		}

		return summaryRows
	}

	private async waitForCheckoutSummaryToStabilize(zipcode: string): Promise<Record<string, string>> {
		const deadline = Date.now() + this.checkoutReviewTimeoutMs
		let lastRows = await this.readCheckoutSummaryRows()

		while (Date.now() < deadline) {
			await this.page.waitForTimeout(this.checkoutSummaryStabilityPollMs)
			const nextRows = await this.readCheckoutSummaryRows()

			if (JSON.stringify(lastRows) === JSON.stringify(nextRows)) {
				return nextRows
			}

			lastRows = nextRows
		}

		throw new Error(
			[
				`Checkout summary did not stabilize within ${this.checkoutReviewTimeoutMs}ms for ZIP ${zipcode}.`,
				`Last captured checkout summary rows: ${JSON.stringify(lastRows, null, 2)}`,
			].join('\n'),
		)
	}

	private buildCheckoutTaxSnapshot(rows: Record<string, string>): CheckoutTaxSnapshot {
		const cartSubTotal = rows.subtotal || '0.00'
		const grossTaxAmount = rows.gross || rows['county gross tax'] || '0.00'
		const exciseTaxAmount = rows.excise || rows['california excise tax'] || '0.00'
		const salesTaxAmount = rows.sales || '0.00'
		const total = rows.total || '0.00'
		const calculatedTotal = (
			parseFloat(cartSubTotal) +
			parseFloat(grossTaxAmount) +
			parseFloat(exciseTaxAmount) +
			parseFloat(salesTaxAmount)
		).toFixed(2)

		return {
			cartSubTotal,
			grossTaxAmount,
			exciseTaxAmount,
			salesTaxAmount,
			total,
			rows,
			calculatedTotal,
		}
	}

	private async captureCheckoutTaxSnapshot(zipcode: string): Promise<CheckoutTaxSnapshot> {
		const rows = await this.readCheckoutSummaryRows()
		const snapshot = this.buildCheckoutTaxSnapshot(rows)

		if (!rows.subtotal || !rows.total) {
			throw new Error(
				[
					`Could not capture checkout totals for ZIP ${zipcode}.`,
					`Available checkout summary rows: ${JSON.stringify(rows, null, 2)}`,
				].join('\n'),
			)
		}

		const totalDifference = Math.abs(
			parseFloat(snapshot.total) - parseFloat(snapshot.calculatedTotal),
		)

		if (totalDifference >= 0.05) {
			throw new Error(
				[
					`Captured checkout rows do not add up to the displayed total for ZIP ${zipcode}.`,
					`Displayed rows: ${JSON.stringify(snapshot.rows, null, 2)}`,
					`Displayed total: ${snapshot.total}`,
					`Calculated total from displayed rows: ${snapshot.calculatedTotal}`,
				].join('\n'),
			)
		}

		return snapshot
	}

	private buildTaxMismatchError(
		zipcode: string,
		usageType: TestUsageType,
		actualTotals: CheckoutTaxSnapshot,
		expectedCartTotal: Record<string, string>,
	): string {
		const refreshDiagnostics = {
			submittedZipcode: this.lastCheckoutRefreshDiagnostics?.submittedZipcode || zipcode,
			postcode: this.lastCheckoutRefreshDiagnostics?.postcode || null,
			billingPostcode: this.lastCheckoutRefreshDiagnostics?.billingPostcode || null,
			fulfillmentType: this.lastCheckoutRefreshDiagnostics?.fulfillmentType || null,
			shippingMethod: this.lastCheckoutRefreshDiagnostics?.shippingMethod || null,
			deliveryAvailable: this.lastCheckoutRefreshDiagnostics?.deliveryAvailable ?? null,
			pickupAvailable: this.lastCheckoutRefreshDiagnostics?.pickupAvailable ?? null,
			deliveryZoneId: this.lastCheckoutRefreshDiagnostics?.deliveryZoneId || null,
			pickupFacilityId: this.lastCheckoutRefreshDiagnostics?.pickupFacilityId || null,
		}

		return [
			`Tax totals mismatch for ZIP ${zipcode} (${isMedicalUsage(usageType) ? 'medical' : 'recreational'}).`,
			`Displayed checkout rows: ${JSON.stringify(actualTotals.rows, null, 2)}`,
			`Displayed total: ${actualTotals.total}`,
			`Expected totals from /rates: ${JSON.stringify(expectedCartTotal, null, 2)}`,
			`QA /rates payload: ${JSON.stringify(this.taxRates, null, 2)}`,
			`Checkout refresh diagnostics: ${JSON.stringify(refreshDiagnostics, null, 2)}`,
		].join('\n')
	}

	async verifyCheckoutTotals(
		zipcode: string,
		usageType: TestUsageType,
		productList: any[],
	): Promise<any> {
		if (process.env.BYPASS_TAX_CALC === 'true') {
			return this.cartTotal
		}

		this.cartItems = []
		await test.step('GET Tax Rates + Product Info', async () => {
			await test.step('GET Tax Rate', async () => {
				//Get Tax Rates
				this.taxRates = await this.qaClient.getRates({ post_code: zipcode })
			})
			await test.step('GET Actual Order Totals', async () => {
				const actualTotals = await this.captureCheckoutTaxSnapshot(zipcode)
				this.cartTotal = {
					cartSubTotal: actualTotals.cartSubTotal,
					grossTaxAmount: actualTotals.grossTaxAmount,
					exciseTaxAmount: actualTotals.exciseTaxAmount,
					salesTaxAmount: actualTotals.salesTaxAmount,
					total: actualTotals.total,
				}

				var expectedCartTotal = await calculateCartTotals(
					this.taxRates,
					productList,
					usageType,
				)
				const actualTotal = parseFloat(this.cartTotal.total)
				const expectedTotal = parseFloat(expectedCartTotal.expectedTotal)

				if (Math.abs(actualTotal - expectedTotal) >= 0.05) {
					throw new Error(
						this.buildTaxMismatchError(
							zipcode,
							usageType,
							actualTotals,
							expectedCartTotal,
						),
					)
				}
			})
		})
		return this.cartTotal
	}
	async confirmCheckout(
		zipcode: string,
		productList: any,
		usageType: TestUsageType,
		singleZip: boolean = false,
		address: string = '9779 Oak Pass Rd',
	): Promise<any> {
		const firstName = faker.name.firstName()
		const lastName = faker.name.lastName()

		let cartTotals
		await test.step('Verify Layout', async () => {
			await assertFooterLinks(this.page)
		})

		if (singleZip === false) {
			for (let i = 0; i < this.zipcodes.length; i++) {
				await test.step(`Verify Order Total for ${this.zipcodes[i]}`, async () => {
					await this.addressModifierButton.waitFor({ state: 'visible' })
					await this.page.waitForTimeout(1000)
					await this.addressModifierButton.click()
					await this.zipCodeInput.waitFor({ state: 'visible' })
					await this.zipCodeInput.scrollIntoViewIfNeeded()
					await this.zipCodeInput.click()
					await this.zipCodeInput.fill(this.zipcodes[i])
					this.lastCheckoutRefreshDiagnostics = await this.waitForCheckoutReviewUpdate(
						this.zipcodes[i],
					)
					cartTotals = await this.verifyCheckoutTotals(this.zipcodes[i], usageType, productList)
				})
			}
		} else {
			this.lastCheckoutRefreshDiagnostics = null
			cartTotals = await this.verifyCheckoutTotals(zipcode, usageType, productList)
		}

		await test.step(`Select Acuity Slot for ${zipcode} `, async () => {
			await this.selectSlot()
		})

		await test.step('Submit New Customer Order', async () => {
			await this.placeOrderButton.waitFor({ state: 'visible' })
			await this.placeOrderButton.click()
		})

		return cartTotals
	}

	async selectSlot() {
		await test.step(`Select Acuity Slot`, async () => {
			await this.page.waitForTimeout(2000)
			const errorMessage = this.page.locator('#datetimeError')

			if (!(await errorMessage.isVisible())) {
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
			}
		})
	}

	async confirmCheckoutDeprecated(
		zipcode: string,
		productList: any,
		usageType: TestUsageType,
		singleZip: boolean = false,
		address: string = '9779 Oak Pass Rd',
	): Promise<any> {
		const firstName = faker.name.firstName()
		const lastName = faker.name.lastName()

		let cartTotals
		await test.step('Verify Layout', async () => {
			await assertFooterLinks(this.page)
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
			await this.phoneInput.fill(faker.phone.phoneNumber('555-###-####'))
		})

		await test.step('Fill in Order Notes', async () => {
			await this.comments.click()
			await this.comments.fill(faker.random.words(30))
		})

		if (singleZip === false) {
			for (let i = 0; i < this.zipcodes.length; i++) {
				await test.step(`Verify Order Total for ${this.zipcodes[i]}`, async () => {
					await this.addressModifierButton.waitFor({ state: 'visible' })
					await this.page.waitForTimeout(1000)
					await this.addressModifierButton.click()
					await this.zipCodeInput.waitFor({ state: 'visible' })
					await this.zipCodeInput.scrollIntoViewIfNeeded()
					await this.zipCodeInput.fill(this.zipcodes[i])
					this.lastCheckoutRefreshDiagnostics = await this.waitForCheckoutReviewUpdate(
						this.zipcodes[i],
					)
					cartTotals = await this.verifyCheckoutTotals(this.zipcodes[i], usageType, productList)
				})
			}
		} else {
			this.lastCheckoutRefreshDiagnostics = null
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
		usageType: TestUsageType,
		singleZip: boolean = false,
		address: string = '9779 Oak Pass Rd',
	): Promise<any> {
		const firstName = faker.name.firstName()
		const lastName = faker.name.lastName()

		let cartTotals
		await test.step('Verify Layout', async () => {
			await assertFooterLinks(this.page)
		})

		if (singleZip === false) {
			for (let i = 0; i < this.zipcodesCO.length; i++) {
				await test.step(`Verify Order Total for ${this.zipcodesCO[i]}`, async () => {
					await this.addressModifierButton.waitFor({ state: 'visible' })
					await this.page.waitForTimeout(1000)
					await this.addressModifierButton.click()
					await this.zipCodeInput.waitFor({ state: 'visible' })
					await this.zipCodeInput.scrollIntoViewIfNeeded()
					await this.zipCodeInput.click()
					await this.zipCodeInput.fill(this.zipcodesCO[i])
					this.lastCheckoutRefreshDiagnostics = await this.waitForCheckoutReviewUpdate(
						this.zipcodesCO[i],
					)
					cartTotals = await this.verifyCheckoutTotals(this.zipcodesCO[i], usageType, productList)
				})
			}
		} else {
			this.lastCheckoutRefreshDiagnostics = null
			cartTotals = await this.verifyCheckoutTotals(zipcode, usageType, productList)
		}

		await test.step(`Select Acuity Slot for ${zipcode} `, async () => {
			await this.selectSlot()
			// var daySlot = await this.page.locator('#svntnAcuityDayChoices >> .acuityChoice').first()
			// await expect(
			// 	daySlot,
			// 	'Could not find Acuity Day Slot Selector. Check Acuity Slots status.',
			// ).toBeVisible()
			// await daySlot.click()

			// var timeSlot = await this.page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first()
			// await expect(
			// 	timeSlot,
			// 	'Could not find Acuity Time Slot Selector. Check Acuity Slots status.',
			// ).toBeVisible()
			// await timeSlot.click()
		})

		await test.step('Submit New Customer Order', async () => {
			await this.placeOrderButton.click()
		})

		return cartTotals
	}
}
