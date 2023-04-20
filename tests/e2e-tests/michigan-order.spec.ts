import { request } from '@playwright/test'
import { test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { faker } from '@faker-js/faker'
import { visualDiff, visualDiffWithMaskArray } from '../../utils/visual-diff'
import { v4 as uuidv4 } from 'uuid'

test.describe('MI Order Tests', () => {
	test.describe.configure({ mode: 'parallel' })

	test(`Basic Order - New Customer - In State - #recreational @MI`, async ({
		page,
		browserName,
		orders,
	}, workerInfo) => {
		const address = '123 Eight Mile Rd MI'
		const apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
		const zipCode = '48161'
		const email = `test+${uuidv4()}@710labs-test.com`
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page, apiContext)
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
				faker.name.firstName() + uuidv4(),
				faker.name.lastName() + uuidv4(),
				faker.internet.email() + uuidv4(),
				faker.internet.password(),
				faker.datatype.number({ min: 1, max: 28 }),
				faker.datatype.number({ min: 10, max: 12 }),
				faker.datatype.number({ min: 1975, max: 2001 }),
				faker.datatype.number({ min: 1111111111, max: 9999999999 }),
				'recreational',
				address,
				faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
				faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
			)
		})
		await test.step(`Enter Fulfillment Method`, async () => {
			await page.locator('#fulfillmentElement').getByText('Pickup', { exact: true }).click()
			await page.getByRole('button', { name: 'Submit' }).click()
			const shopMasks = [shopPage.productImage]
			await visualDiffWithMaskArray(page, `store-landing-page-new-MI-instate-REC-${process.env.ENV}.png`, 1500, shopMasks)
		})

		await test.step(`Add Products`, async () => {
			var order = await faker.datatype.number({ min: 0, max: orders.length - 1 })
			await test.step(`Load Cart - Order #${order}`, async () => {
				await shopPage.addProductListToCart(orders[order])
			})
		})

		await test.step(`Navigate to Cart`, async () => {
			await shopPage.goToCart()
			var cartMaskLocators = [cartPage.productName, cartPage.productImage, cartPage.productImage2, cartPage.reservationTimer]
			await visualDiffWithMaskArray(page, `cart-page-new-MI-instate-rec-${process.env.ENV}.png`, 1500, cartMaskLocators)
		})

		await test.step(`Navigate to Checkout`, async () => {
			await cartPage.goToCheckout()
			var checkoutMaskLocators = [checkOutPage.personalInfoField, checkOutPage.reservationTimer, checkOutPage.AppointmentsSection, checkOutPage.FulfillmentMethodSection, checkOutPage.AddressSection]
			await visualDiffWithMaskArray(page, `checkout-page-new-MI-instate-rec-${process.env.ENV}.png`, 1500, checkoutMaskLocators)
		})

		await test.step(`Choose Acuity Slot`, async () => {
			await checkOutPage.selectSlot()
		})

		await test.step(`Complete Order`, async () => {
			await checkOutPage.placeOrderButton.click()
		})
	})

	test(`Basic Order - New Customer - Out Of State - #recreational @MI`, async ({
		page,
		browserName,
		orders,
	}, workerInfo) => {
		const address = '123 Broadway New York'
		const apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
		const zipCode = '48161'
		const email = `test+${uuidv4()}@710labs-test.com`
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page, apiContext)
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
				faker.name.firstName() + uuidv4(),
				faker.name.lastName() + uuidv4(),
				faker.internet.email() + uuidv4(),
				faker.internet.password(),
				faker.datatype.number({ min: 1, max: 28 }),
				faker.datatype.number({ min: 10, max: 12 }),
				faker.datatype.number({ min: 1975, max: 2001 }),
				faker.datatype.number({ min: 1111111111, max: 9999999999 }),
				'recreational',
				address,
				faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
				faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
			)
			//await createAccountPage.create(email, 'test1234', zipCode, 1)
		})
		await test.step(`Enter Fulfillment Method`, async () => {
			await page.locator('#fulfillmentElement').getByText('Pickup', { exact: true }).click()
			await page.getByRole('button', { name: 'Submit' }).click()
		})

		await test.step(`Add Products`, async () => {
			await visualDiff(page, `store-landing-page-new-MI-outstate-rec-${process.env.ENV}.png`, 1500)
			var order = await faker.datatype.number({ min: 0, max: orders.length - 1 })
			await test.step(`Load Cart - Order #${order}`, async () => {
				await shopPage.addProductListToCart(orders[order])
				//await shopPage.addProductsToCart(6, mobile);
			})
		})

		await test.step(`Navigate to Cart`, async () => {
			await shopPage.goToCart()
			var cartMaskLocators = [cartPage.productName, cartPage.productImage, cartPage.productImage2, cartPage.reservationTimer]
			await visualDiffWithMaskArray(page, `cart-page-new-MI-outstate-rec-${process.env.ENV}.png`, 1500, cartMaskLocators)
		})

		await test.step(`Navigate to Checkout`, async () => {
			await cartPage.goToCheckout()
			var checkoutMaskLocators = [checkOutPage.personalInfoField, checkOutPage.reservationTimer, checkOutPage.AppointmentsSection, checkOutPage.FulfillmentMethodSection, checkOutPage.AddressSection]
			await visualDiffWithMaskArray(page, `checkout-page-new-MI-outstate-rec-${process.env.ENV}.png`, 1500, checkoutMaskLocators)
		})

		await test.step(`Choose Acuity Slot`, async () => {
			await checkOutPage.selectSlot()
		})

		await test.step(`Complete Order`, async () => {
			await checkOutPage.placeOrderButton.click()
		})
	})
})
