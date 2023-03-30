const csvFilePath = 'utils/hod-orders.csv'
let csvToJson = require('convert-csv-to-json')
import { test, expect, devices, request, Page } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { ShopPage } from '../../models/shop-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'

test.describe('House Of Dank Order Generator', () => {
	let orders = csvToJson.fieldDelimiter(',').getJsonFromCsv(csvFilePath)
	test.describe.configure({ mode: 'parallel' })

	var order1 = [
		'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
		'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	]

	var order2 = [
		'1271381 | Half Ounce', //Gummiez #12 (https://thelist-dev.710labs.com/product/gummiez-12/)
		'1221676', //Cake Crasher (https://thelist-dev.710labs.com/product/cake-crasher/)
		'1149561', //Gak Smoovie #5 (https://thelist-dev.710labs.com/product/gak-smoovie-5/)
	]

	var order3 = [
		'1233744', //Blueberry Haze (https://thelist-dev.710labs.com/product/blueberry-haze-2/)
		'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	]

	var order4 = [
		'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
		'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'1099685', //Zkittlez (https://thelist-dev.710labs.com/product/zkittlez/)
	]

	var order5 = [
		'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
		'1032839', //Sundae Driver (https://thelist-dev.710labs.com/product/sundae-driver/)
		'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	]

	for (let index = 0; index < orders.length; index++) {
		test(`Add House of Dank Order: ${orders[index].first_name} ${orders[index].last_name} - DOB:${orders[index].dob_month}/${orders[index].dob_day}/${orders[index].dob_year} - ${orders[index].customer_type} - ${orders[index].address} - Order[${orders[index].order}]`, async ({
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

			let address

			switch (orders[index].address) {
				case 'in_state':
					address = '123 8 Mile Road'
					break
				case 'out_of_state':
					address = '123 Broadway New York'
					break
				default:
			}

			await test.step(`Pass Age Gate`, async () => {
				await ageGatePage.passAgeGate()
			})

			await test.step(`Enter List Password`, async () => {
				await listPassword.submitPassword('qatester')
			})

			await test.step(`Create Account`, async () => {
				await createAccountPage.createMichiganCustomer(
					orders[index].first_name,
					orders[index].last_name,
					orders[index].email,
					orders[index].password,
					orders[index].dob_day,
					orders[index].dob_month,
					orders[index].dob_year,
					orders[index].phone,
					orders[index].customer_type,
					address,
					orders[index].med_card_number,
					orders[index].drivers_license_number,
				)
			})

			await test.step(`Enter Fulfillment Method`, async () => {
				await page.locator('#fulfillmentElement').getByText('Pickup', { exact: true }).click()
				await page.getByRole('button', { name: 'Submit' }).click()
			})

			await test.step(`Add Products`, async () => {
				switch (orders[index].order) {
					case '1':
						await test.step(`Load Cart - Order #1`, async () => {
							await shopPage.addProductListToCart(order1)
						})
						break
					case '2':
						await test.step(`Load Cart - Order #2`, async () => {
							await shopPage.addProductListToCart(order2)
						})
						break
					case '3':
						await test.step(`Load Cart - Order #3`, async () => {
							await shopPage.addProductListToCart(order3)
						})
						break
					case '4':
						await test.step(`Load Cart - Order #4`, async () => {
							await shopPage.addProductListToCart(order4)
						})
						break
					case '5':
						await test.step(`Load Cart - Order #5`, async () => {
							await shopPage.addProductListToCart(order5)
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
