import { expect, test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'
import { v4 as uuidv4 } from 'uuid'
import { faker } from '@faker-js/faker'
import { coloradoAddressess } from '../../utils/data-generator'
import { fictionalAreacodes } from '../../utils/data-generator'
import { writeFileSync } from 'fs'
import { getSmokeCartItemCount } from '../../utils/smoke-cart-item-count'

test.describe('Basic Acceptance Tests CO', () => {
	const cartItemCount = getSmokeCartItemCount()
	var orderNumber: any
	var cartTotals: any

	test(`Basic Acceptance Test - Medical @medical @smoke`, async ({ page, browserName, context, qaClient }, workerInfo) => {
		test.skip(workerInfo.project.name === 'Mobile Chrome')
		await context.addCookies([
			{
				name: 'vipChecker',
				value: '3',
				domain: process.env.BASE_URL?.replace('https://', ''),
				path: '/',
			},
		])
		const address = faker.helpers.arrayElement(coloradoAddressess)
		var fakeFirstName = faker.name.firstName() + '_Test'
		var fakeLastName = faker.name.lastName() + '_Test'
		var fakeEmail = faker.internet.email(fakeFirstName, fakeLastName, 'test710labstest.com') // 'Jeanne_Doe88@example.fakerjs.dev'

		const email = `test+${uuidv4()}@710labs-test.com`
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, qaClient)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'medical')
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
				address.zipcode,
				'medical',
				false,
				address.fullAddress,
				'CO',
			)
		})

		await test.step('Add Products to Cart', async () => {
			await shopPage.addProductsToCart(cartItemCount, mobile, 'Pickup', 'medical', {
				exactItemCount: true,
			})
			cartTotals = await cartPage.verifyCart(address.zipcode)
		})

		await test.step('Choose Fulfillment Slot + Verify Checkout', async () => {
			await checkOutPage.confirmCheckout(address.zipcode, cartTotals, 'medical', true, address)
		})

		await test.step('Comfirm Order Details on /order-received', async () => {
			orderNumber = await orderReceived.getOrderNumber()
			expect(orderNumber, 'Failed to create order').not.toBeNull()
			//write order number to file to use for cancel order via API
			writeFileSync('order_id.txt', String(orderNumber), { encoding: 'utf-8' })
			console.log(`✅ Wrote order_id.txt → ${orderNumber}`)
		})
	})

})
