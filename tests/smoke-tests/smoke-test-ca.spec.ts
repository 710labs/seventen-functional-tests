import { expect, test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'
import { faker } from '@faker-js/faker'
import { writeFileSync } from 'fs'

test.describe('Basic Acceptance Tests CA', () => {
	const zipCode = '90210'
	const orderQuanity = 2
	var orderNumber: any
	var cartTotals: any

	test(`Basic Acceptance Test - Recreational @rec @smoke`, async ({ page, browserName, context, qaClient }, workerInfo) => {
		test.skip(workerInfo.project.name === 'Mobile Chrome')
		await context.addCookies([
			{
				name: 'vipChecker',
				value: '3',
				domain: process.env.BASE_URL?.replace('https://', ''),
				path: '/',
			},
		])
		const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
		var fakeFirstName = faker.name.firstName() + '_Test'
		var fakeLastName = faker.name.lastName() + '_Test'
		var fakeEmail = faker.internet.email(fakeFirstName, fakeLastName, 'test710labstest.com') // 'Jeanne_Doe88@example.fakerjs.dev'

		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, qaClient)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')
		const checkOutPage = new CheckoutPage(page, qaClient)
		const orderReceived = new OrderReceivedPage(page)
		var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

		await test.step('Pass Age Gate', async () => {
			await ageGatePage.passAgeGate()
		})

		await test.step('Enter List Password', async () => {
			await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
		})

		await test.step('Create Account', async () => {
			await createAccountPage.create(
				fakeFirstName,
				fakeLastName,
				fakeEmail,
				'test1234',
				zipCode,
				'recreational',
				false,
				address,
				'CA',
			)
		})

		await test.step('Add Products to Cart', async () => {
			await shopPage.addProductsToCart(orderQuanity, mobile, 'Delivery', 'recreational')
			cartTotals = await cartPage.verifyCart(zipCode)
		})

		await test.step('Choose Fulfillment Slot + Verify Checkout', async () => {
			await checkOutPage.confirmCheckout(zipCode, cartTotals, 'recreational', true, address)
		})

		await test.step('Comfirm Order Details on /order-received', async () => {
			orderNumber = await orderReceived.getOrderNumber()
			await expect(orderNumber, 'Failed to create order').not.toBeNull()
			//write order number to file to use for cancel order via API
			writeFileSync('order_id.txt', String(orderNumber), { encoding: 'utf-8' })
			console.log(`✅ Wrote order_id.txt → ${orderNumber}`)
		})
	})
})
