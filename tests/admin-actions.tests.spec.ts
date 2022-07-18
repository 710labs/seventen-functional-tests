import { test, expect, FullConfig, request } from '@playwright/test'
import { PlaywrightTestConfig } from '@playwright/test'
import { ListPasswordPage } from '../models/list-password-protect-page'
import { AgeGatePage } from '../models/age-gate-page'
import { LoginPage } from '../models/login-page'
import { ShopPage } from '../models/shop-page'
import { CreateAccountPage } from '../models/create-account-page'
import { CheckoutPage } from '../models/checkout-page'
import { CartPage } from '../models/cart-page'
import { MyAccountPage } from '../models/my-account-page'
import { AdminLogin } from '../models/admin-login-page'
import { OrderReceivedPage } from '../models/order-recieved-page'
import { EditOrderPage } from '../models/edit-order-page'
import { SchedulingPage } from '../models/scheduling-page'
import { v4 as uuidv4 } from 'uuid'
import { faker } from '@faker-js/faker'

test.describe('Admin Split Order', () => {
	const zipCode = '90210'
	const orderQuanity = 6
	var orderTotals
	var orderNumber

	test.beforeEach(async ({ page, browserName }, workerInfo) => {
		test.skip(workerInfo.project.name === 'mobile-chrome')
		const apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
		const address = '9779 Oak Pass Rd'
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
		const schedulingPage = new SchedulingPage(page)
		const orderReceived = new OrderReceivedPage(page)
		const checkOutPage = new CheckoutPage(page, apiContext)
		const myAccountPage = new MyAccountPage(page)

		await ageGatePage.passAgeGate()
		await listPassword.submitPassword('qatester')
		await createAccountPage.create(
			`test+${uuidv4()}@710labs-test.com`,
			'test1234!',
			zipCode,
			1,
			false,
			address,
		)
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
			await myAccountPage.addAddress()
		}
		await shopPage.addProductsToCart(6)
		var cartTotals = await cartPage.verifyCart(zipCode)
		await test.step('Verify Checkout Page Totals + Taxes', async () => {
			orderTotals = await checkOutPage.confirmCheckout(zipCode, cartTotals, 1, true)
		})
		await test.step('Schedule Delivery', async () => {
			await schedulingPage.scheduleDelivery()
		})

		await test.step('Comfirm Order Details on /order-received', async () => {
			orderNumber = await orderReceived.confirmOrderDetail(orderTotals)
			await expect(orderNumber, 'Failed to create order').not.toBeNull()
		})

		await test.step('Logout Consumer', async () => {
			await myAccountPage.logout()
		})
	})
	test(`User Can Split Order @CA`, async ({ page, browserName }, workerInfo) => {
		const adminLoginPage = new AdminLogin(page)
		const editOrderPage = new EditOrderPage(page)
		await test.step('Login Admin', async () => {
			await adminLoginPage.login()
		})
		await test.step('Admin Split Order', async () => {
			await editOrderPage.splitOrder(orderNumber, orderQuanity)
		})
	})
})
