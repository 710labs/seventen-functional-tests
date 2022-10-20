import { test, expect, devices, request } from '@playwright/test'
import { ListPasswordPage } from '../models/list-password-protect-page'
import { AgeGatePage } from '../models/age-gate-page'
import { LoginPage } from '../models/login-page'
import { ShopPage } from '../models/shop-page'
import { CreateAccountPage } from '../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../models/checkout-page'
import { CartPage } from '../models/cart-page'
import { SchedulingPage } from '../models/scheduling-page'
import { MyAccountPage } from '../models/my-account-page'
import zipcodes from '../utils/zipcodes-fl.json'
import { AdminLogin } from '../models/admin-login-page'
import { EditOrderPage } from '../models/edit-order-page'
import { OrderReceivedPage } from '../models/order-recieved-page'

test.describe('Medical Customer Checkout Florida', () => {
	var orderTotals
	var orderNumber
	var splitOrderNumber
	const orderQuanity = 6

	test(`Basic Acceptance Test @smoke`, async ({ page, browserName, context }, workerInfo) => {
		test.skip(workerInfo.project.name === 'mobile-chrome')
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
		const address = "3275 NW 24th Street Rd"
		const email = `test+${uuidv4()}@710labs-test.com`
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const myAccountPage = new MyAccountPage(page)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page, apiContext)
		const schedulingPage = new SchedulingPage(page)
		const adminLoginPage = new AdminLogin(page)
		const editOrderPage = new EditOrderPage(page)
		const orderReceived = new OrderReceivedPage(page)

		await ageGatePage.passAgeGate('FL')
		await listPassword.submitPassword('qatester')
		await createAccountPage.create(email, 'test1234', zipCode, 1, false, address, 'FL')
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
			await myAccountPage.addAddress(address, 'Miami', '1234567890', 'FL')
		}
		await shopPage.addProductsToCart(orderQuanity)
		var cartTotals = await cartPage.verifyCart(zipCode)
		await checkOutPage.confirmCheckout(zipCode, cartTotals, 1, true, address)
		await schedulingPage.scheduleDelivery()
		await test.step('Comfirm Order Details on /order-received', async () => {
			orderNumber = await orderReceived.confirmOrderDetail(orderTotals)
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
