import { test, expect, request } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { MyAccountPage } from '../../models/my-account-page'
import { AdminLogin } from '../../models/admin/admin-login-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'
import { EditOrderPage } from '../../models/admin/edit-order-page'
import { v4 as uuidv4 } from 'uuid'
import { faker } from '@faker-js/faker'
import { coloradoAddressess } from '../../utils/data-generator'

test.describe('Basic Acceptance Tests CO', () => {
	const orderQuanity = 6
	var orderNumber: any
	var splitOrderNumber: string
	var cartTotals: any

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
		const address = faker.helpers.arrayElement(coloradoAddressess)
		const email = `test+${uuidv4()}@710labs-test.com`
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
				email,
				'test1234',
				address.zipcode,
				1,
				false,
				address.fullAddress,
				'CO',
			)
		})

		await test.step('Add Products to Cart', async () => {
			await shopPage.addProductsToCart(orderQuanity, mobile, 'Pickup')
			cartTotals = await cartPage.verifyCart(address.zipcode)
		})

		await test.step('Choose Fulfillment Slot + Verify Checkout', async () => {
			await checkOutPage.confirmCheckout(address.zipcode, cartTotals, 1, true, address)
		})

		await test.step('Comfirm Order Details on /order-received', async () => {
			orderNumber = await orderReceived.getOrderNumber()
			expect(orderNumber, 'Failed to create order').not.toBeNull()
		})
		await test.step('Logout Consumer', async () => {
			await myAccountPage.logout()
		})

		await test.step('Login Admin', async () => {
			await adminLoginPage.login()
		})

		await test.step('Cancel Order', async () => {
			await editOrderPage.cancelOrder(orderNumber)
		})
	})
})
