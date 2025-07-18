import { test, expect, devices, request } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { MyAccountPage } from '../../models/my-account-page'
import zipcodes from '../../utils/zipcodes-fl.json'
import { AdminLogin } from '../../models/admin/admin-login-page'
import { EditOrderPage } from '../../models/admin/edit-order-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'

test.describe('Medical Customer Checkout Florida', () => {
	var cartTotals: any
	var orderNumber: any
	var splitOrderNumber: string
	const orderQuanity = 6

	test(`Basic Acceptance Test @smoke`, async ({ page, browserName, context }, workerInfo) => {
		test.skip(workerInfo.project.name === 'Mobile Chrome')
		const apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
		await context.addCookies([
			{
				name: 'vipChecker',
				value: '3',
				domain: process.env.BASE_URL?.replace('https://', ''),
				path: '/',
			},
		])
		var index = await Math.floor(Math.random() * (zipcodes.length - 0) + 0)
		const zipCode = zipcodes[index]
		const address = '3275 NW 24th Street Rd'
		var fakeFirstName = faker.name.firstName() + '_Test'
		var fakeLastName = faker.name.lastName() + '_Test'
		var fakeEmail = faker.internet.email(fakeFirstName, fakeLastName, 'test710labstest.com') // 'Jeanne_Doe88@example.fakerjs.dev'

		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const myAccountPage = new MyAccountPage(page)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page, apiContext)
		const adminLoginPage = new AdminLogin(page)
		const editOrderPage = new EditOrderPage(page)
		const orderReceived = new OrderReceivedPage(page)
		var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

		await test.step('Pass Age Gate', async () => {
			await ageGatePage.passAgeGate()
		})

		await test.step('Enter List Password', async () => {
			await listPassword.submitPassword('qatester')
		})

		await test.step('Create Account', async () => {
			await createAccountPage.create(
				fakeFirstName,
				fakeLastName,
				fakeEmail,
				'test1234',
				zipCode,
				1,
				false,
				address,
				'FL',
			)
		})

		await test.step('Add Products to Cart', async () => {
			await shopPage.addProductsToCart(orderQuanity, mobile)
			cartTotals = await cartPage.verifyCart(zipCode)
		})

		await test.step('Choose Fulfillment Slot + Verify Checkout', async () => {
			await checkOutPage.confirmCheckout(zipCode, cartTotals, 1, true, address)
		})

		await test.step('Comfirm Order Details on /order-received', async () => {
			orderNumber = await orderReceived.getOrderNumber()
			await expect(orderNumber, 'Failed to create order').not.toBeNull()
		})
		await test.step('Logout Consumer', async () => {
			await myAccountPage.logout()
		})

		await test.step('Login Admin', async () => {
			await adminLoginPage.login()
		})
		await test.step('Admin Split Order', async () => {
			splitOrderNumber = await editOrderPage.splitOrder(orderNumber, orderQuanity)
		})
		await test.step('Cancel Order', async () => {
			await editOrderPage.cancelOrder(orderNumber)
			await editOrderPage.cancelOrder(splitOrderNumber)
		})
	})
})
