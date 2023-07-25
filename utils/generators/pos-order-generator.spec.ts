const csvFilePath = 'utils/hod-orders.csv'
let csvToJson = require('convert-csv-to-json')
import { test, expect, devices, request, Page } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { ShopPage } from '../../models/shop-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { faker } from '@faker-js/faker'

test.describe('POS Order Generator', () => {
	let orders = csvToJson.fieldDelimiter(',').getJsonFromCsv(csvFilePath)
	test.describe.configure({ mode: 'parallel' })

	var order1 = [
		'142698', //Rainbow Belts (https://thelist-dev.710labs.com/product/rainbow-belts-4/)
		'142698', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'142698', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	]

	var order2 = [
		'142698', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
		'142698', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'142698', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	]

	var order3 = [
		'142698', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
		'142698', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'142698', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	]

	var orderCount = process.env.ORDER_COUNT

	for (let index = 0; index < parseInt(orderCount); index++) {
		var first_name = faker.name.firstName()
		var last_name = faker.name.lastName()
		var email = `${first_name}.${last_name}@pos-sync.com`.toLocaleLowerCase()
		var password = 'test1234'
		var dob_day = faker.datatype.number({ min: 1, max: 12 })
		var dob_month = faker.datatype.number({ min: 1, max: 25 })
		var dob_year = faker.datatype.number({ min: 1955, max: 2001 })
		var phone = faker.phone.phoneNumber()
		var customer_type = 'recreational'
		var address = '3324 S La Cienega Blvd, Los Angeles'
		var med_card_number = faker.random.numeric(8)
		var drivers_license_number = faker.random.numeric(8)
		var order = faker.datatype.number({ min: 1, max: 3 })

		test(`Add Order: ${email} - DOB:${dob_month}/${dob_day}/${dob_year} - ${customer_type} - ${address} - Order[${order}]`, async ({
			page,
			browserName,
		}, workerInfo) => {
			const apiContext = await request.newContext({
				baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
				extraHTTPHeaders: {
					'x-api-key': `${process.env.API_KEY}`,
				},
			})
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, apiContext)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
			const checkOutPage = new CheckoutPage(page, apiContext)
			test.skip(workerInfo.project.name === 'Mobile Chrome')

			await test.step(`Pass Age Gate`, async () => {
				await ageGatePage.passAgeGate()
			})

			await test.step(`Enter List Password`, async () => {
				await listPassword.submitPassword('qatester')
			})

			await test.step(`Create Account`, async () => {
				await createAccountPage.createCaliforniaCustomer(
					first_name,
					last_name,
					email,
					password,
					dob_day,
					dob_month,
					dob_year,
					phone,
					customer_type,
					address,
					med_card_number,
					drivers_license_number,
				)
			})

			await test.step(`Enter Fulfillment Method`, async () => {
				await page.locator('#fulfillmentElement').getByText('Pickup', { exact: true }).click()
				await page.getByRole('button', { name: 'Submit' }).click()
			})

			await test.step(`Add Products`, async () => {
				switch (order) {
					case 1:
						await test.step(`Load Cart - Order #1`, async () => {
							await shopPage.addProductListToCart(order1)
						})
						break
					case 2:
						await test.step(`Load Cart - Order #2`, async () => {
							await shopPage.addProductListToCart(order2)
						})
						break
					case 3:
						await test.step(`Load Cart - Order #3`, async () => {
							await shopPage.addProductListToCart(order3)
						})
						break
					case 4:
						await test.step(`Load Cart - Order #4`, async () => {
							await shopPage.addProductListToCart(order1)
						})
						break
					case 5:
						await test.step(`Load Cart - Order #5`, async () => {
							await shopPage.addProductListToCart(order1)
						})
						break
					default:
				}
			})

			await test.step(`Navigate to Cart`, async () => {
				await shopPage.goToCart()
			})

			await test.step(`Navigate to Checkout`, async () => {
				await cartPage.goToCheckout()
			})

			await test.step(`Choose Acuity Slot`, async () => {
				await checkOutPage.selectSlot()
			})

			await test.step(`Complete Order`, async () => {
				await checkOutPage.placeOrderButton.click()
			})
		})
	}
})
