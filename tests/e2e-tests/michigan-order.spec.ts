import { test, request } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { faker } from '@faker-js/faker'

var orders = [
	[
		'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
		'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	],
	[
		'1271381 | Half Ounce', //Gummiez #12 (https://thelist-dev.710labs.com/product/gummiez-12/)
		'1221676', //Cake Crasher (https://thelist-dev.710labs.com/product/cake-crasher/)
		'1149561', //Gak Smoovie #5 (https://thelist-dev.710labs.com/product/gak-smoovie-5/)
	],
	[
		'1233744', //Blueberry Haze (https://thelist-dev.710labs.com/product/blueberry-haze-2/)
		'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	],
	[
		'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
		'1352101', //Pie Scream #7 + Pielatti (https://thelist-dev.710labs.com/product/pie-scream-7-pielatti/)
		'1099685', //Zkittlez (https://thelist-dev.710labs.com/product/zkittlez/)
	],
	[
		'1246884', //Starburst 36 #1 (https://thelist-dev.710labs.com/product/starburst-36-1-2/)
		'1032839', //Sundae Driver (https://thelist-dev.710labs.com/product/sundae-driver/)
		'1352065', //Randy Watzon #13 + Blueberry Haze (https://thelist-dev.710labs.com/product/randy-watzon-13-blueberry-haze/)
	],
]

test(`Basic Order - New Customer - In State - #medical @MI`, async ({
	page,
	browserName,
}, workerInfo) => {
	const address = '123 Eight Mile Rd'
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
		await createAccountPage.createMichiganCustomer(
			faker.name.firstName(),
			faker.name.lastName(),
			faker.internet.email(),
			faker.internet.password(),
			faker.datatype.number({ min: 1, max: 28 }),
			faker.datatype.number({ min: 10, max: 12 }),
			faker.datatype.number({ min: 1975, max: 2001 }),
			~~faker.phone.phoneNumber('##########'),
			'medical',
			address,
			faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
			faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
		)
	})
	await test.step(`Enter Fulfillment Method`, async () => {
		await page.locator('#fulfillmentElement').getByText('Pickup', { exact: true }).click()
		await page.getByRole('button', { name: 'Submit' }).click()
	})

	await test.step(`Add Products`, async () => {
		var order = await faker.datatype.number({ min: 0, max: orders.length - 1 })
		await test.step(`Load Cart - Order #${order}`, async () => {
			await shopPage.addProductListToCart(orders[order])
		})
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
