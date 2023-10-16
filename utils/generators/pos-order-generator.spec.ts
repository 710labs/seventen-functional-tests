import { test, request } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { ShopPage } from '../../models/shop-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { faker } from '@faker-js/faker'
import { URL } from 'url'
import posOrders from '../generators/pos-orders.json'

test.describe('POS Order Generator', () => {
	var orders = posOrders.filter(
		(order: { environment: string | undefined; name; id; products }) =>
			order.environment === process.env.POSSYNC_ENVIRONMENT,
	)

	if (process.env.POSSYNC_CART_TYPE?.includes('Over Limit')) {
		orders = orders.filter(
			(order: { environment: string | undefined; name; id; products }) =>
				order.name === process.env.POSSYNC_CART_TYPE,
		)
	} else if (process.env.POSSYNC_CART_TYPE?.includes('Under Limit')) {
		orders = orders.filter(
			(order: { environment: string | undefined; name; id; products }) =>
				order.name == process.env.POSSYNC_CART_TYPE,
		)
	} else if (process.env.POSSYNC_CART_TYPE?.includes('Random')) {
		orders = orders.filter(
			(order: { environment: string | undefined; name; id; products }) =>
				order.name == process.env.POSSYNC_CART_TYPE,
		)
	}

	var orderCount = process.env.POSSYNC_ORDER_COUNT

	async function getOrderNumber(url) {
		const parsedURL = new URL(url)
		const pathname = parsedURL.pathname

		// Use regex to extract the desired string from the pathname
		const regex = /\/(\d+)\/?/
		const match = pathname.match(regex)

		// Check if the regex matched and get the extracted string
		const extractedString = match ? match[1] : null

		return extractedString
	}

	for (let index = 0; index < parseInt(orderCount); index++) {
		var first_name = faker.name.firstName()
		var last_name = faker.name.lastName()
		var email = `${process.env.POSSYNC_PREFIX}-${first_name}.${last_name}-${Math.floor(
			new Date().getTime() / 1000,
		)}@pos-sync.com`.toLocaleLowerCase()
		var password = 'test1234'
		var dob_day = faker.datatype.number({ min: 10, max: 25 })
		var dob_month = faker.datatype.number({ min: 10, max: 12 })
		var dob_year = faker.datatype.number({ min: 1955, max: 2001 })
		var phone = faker.phone.phoneNumber('###-###-####')
		var customer_type =
			process.env.POSSYNC_CUSTOMER_TYPE === 'Random'
				? faker.helpers.arrayElement(['Recreational', 'Medical'])
				: process.env.POSSYNC_CUSTOMER_TYPE
		var address = process.env.POSSYNC_ADDRESS
		var med_card_number = faker.random.numeric(8)
		var drivers_license_number = faker.random.numeric(8)
		var fulfillmentType =
			process.env.POSSYNC_FULFILLMENT_TYPE === 'Random'
				? faker.helpers.arrayElement(['Pickup', 'Delivery'])
				: process.env.POSSYNC_FULFILLMENT_TYPE
		var cart_type = process.env.POSSYNC_CART_TYPE

		var cart_type =
			process.env.POSSYNC_CART_TYPE === 'Random'
				? faker.helpers.arrayElement(['Over Limit MMU', 'Under Limit MMU'])
				: process.env.POSSYNC_FULFILLMENT_TYPE

		test(`${process.env.POSSYNC_ENVIRONMENT?.toUpperCase()} - ${cart_type} - POS Sync Add Order: ${
			index + 1
		}`, async ({ page, browserName }, workerInfo) => {
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
				await page
					.locator('#fulfillmentElement')
					.getByText(`${fulfillmentType}`, { exact: true })
					.click()
				await page.getByRole('button', { name: 'Submit' }).click()

				test.info().annotations.push({
					type: 'Fulfillment Type',
					description: `${fulfillmentType}`,
				})
			})

			await test.step(`Add Products`, async () => {
				switch (cart_type) {
					case 'Over Limit MMU':
						await test.step(`Load Cart - All Product Types`, async () => {
							await shopPage.addProductListToCart(
								orders
									.find(order => order.name === 'Over Limit MMU')
									.products.map(product => product.sku),
							)
							let iterationNumber = 1
							orders
								.find(order => order.id == 1)
								.products.forEach(product => {
									test.info().annotations.push({
										type: `Product ${iterationNumber}`,
										description: `${product.sku} - ${product.name} - (${product.url})`,
									})
									iterationNumber++
								})
						})
						break
					case 'Under Limit MMU':
						await test.step(`Load Cart - Only Cannabis`, async () => {
							await shopPage.addProductListToCart(
								orders
									.find(order => order.name === 'Under Limit MMU')
									.products.map(product => product.sku),
							)
							let iterationNumber = 1
							orders
								.find(order => order.id == 2)
								.products.forEach(product => {
									test.info().annotations.push({
										type: `Product ${iterationNumber}`,
										description: `${product.sku} - ${product.name} - (${product.url})`,
									})
									iterationNumber++
								})
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

				await page.waitForSelector('.woocommerce-order-overview__order > strong')

				var order = await getOrderNumber(page.url())

				test.info().annotations.push({
					type: 'Order',
					description: `${process.env.BASE_URL}wp-admin/post.php?post=${order}&action=edit`,
				})
			})
		})
	}
})
