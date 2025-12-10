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
import { fictionalAreacodes } from '../../utils/data-generator'
import { writeFileSync } from 'fs'

test.describe('Basic Acceptance Tests MI', () => {
	const zipCode = '90210'
	const orderQuanity = 6
	var orderNumber: any
	var splitOrderNumber: string
	var cartTotals: any

	test(`Basic Acceptance Test - Medical @medical @smoke`, async ({ page, browserName, context }, workerInfo) => {
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

		const address = '123 Eight Mile Rd MI'
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
		test.skip(workerInfo.project.name === 'Mobile Chrome')

		await test.step(`Pass Age Gate`, async () => {
			await ageGatePage.passAgeGate()
		})

		await test.step(`Enter List Password`, async () => {
			await listPassword.submitPassword('qatester')
		})

		await test.step(`Create Account`, async () => {
			await createAccountPage.createMichiganCustomer(
				fakeFirstName,
				fakeLastName,
				fakeEmail,
				faker.internet.password(),
				faker.datatype.number({ min: 1, max: 28 }),
				faker.datatype.number({ min: 10, max: 12 }),
				faker.datatype.number({ min: 1975, max: 2001 }),
				faker.phone.phoneNumber('555-###-####'),
				'recreational',
				address,
				faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
				faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
			)
		})

		await test.step(`Load Shopping Cart`, async () => {
			await shopPage.addProductsToCart(4, false, 'Pickup', 'Medical')
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
			await checkOutPage.placeOrderButton.waitFor({ state: 'visible' })
			await checkOutPage.placeOrderButton.click()
			await orderReceived.orderNumber.waitFor({ state: 'visible' })
		})

		await test.step('Comfirm Order Details on /order-received', async () => {
			orderNumber = await orderReceived.getOrderNumber()
			await expect(orderNumber, 'Failed to create order').not.toBeNull()
			//write order number to file to use for cancel order via API
			writeFileSync('order_id.txt', String(orderNumber), { encoding: 'utf-8' })
			console.log(`✅ Wrote order_id.txt → ${orderNumber}`)
		})
		await test.step('Logout Consumer', async () => {
			await myAccountPage.logout()
		})

		await test.step('Login Admin', async () => {
			await adminLoginPage.login()
		})
		await test.step('Admin Split Order', async () => {
			splitOrderNumber = await editOrderPage.splitOrder(orderNumber, orderQuanity)
			//write split order number to file to use for cancel order via API
			writeFileSync('split_order_id.txt', String(splitOrderNumber), { encoding: 'utf-8' })
			console.log(`✅ Wrote split_order_id.txt → ${splitOrderNumber}`)
		})
		await test.step('Cancel Order', async () => {
			await editOrderPage.cancelOrder(orderNumber)
			await editOrderPage.cancelOrder(splitOrderNumber)
		})
	})
})
