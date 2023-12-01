import { test, request, APIRequestContext } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { faker } from '@faker-js/faker'
import { coloradoAddressess, randomUsAddresses } from '../../utils/data-generation'

test.describe('CO Order Tests', () => {
	test.describe.configure({ mode: 'parallel' })
	var apiContext: APIRequestContext
	test.beforeAll(async () => {
		apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
	})
	test(`Basic Recreational Order - New Customer - In State @CO`, async ({
		page,
		browserName,
	}, workerInfo) => {
		const email = `test+${uuidv4()}@710labs-test.com`
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page, apiContext)
		var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false
		let address = faker.helpers.arrayElement(coloradoAddressess)

		await ageGatePage.passAgeGate()
		await listPassword.submitPassword('qatester')
		await createAccountPage.create(
			email,
			'test1234',
			address.zipcode,
			0,
			false,
			address.fullAddress,
			'CO',
		)
		await shopPage.addProductsToCart(6, mobile)
		var cartTotals = await cartPage.verifyCart(address.zipcode)
		await checkOutPage.confirmCheckout(address.zipcode, cartTotals, 1)
	})
	test(`Basic Recreational Order - New Customer - Out Of State @CO`, async ({
		page: page,
		browserName,
	}, workerInfo) => {
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 0)
		const checkOutPage = new CheckoutPage(page, apiContext)
		var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false
		let address = faker.helpers.arrayElement(randomUsAddresses)

		await ageGatePage.passAgeGate()
		await listPassword.submitPassword('qatester')
		await createAccountPage.create(
			`test+${uuidv4()}@710labs-test.com`,
			'test1234!',
			address.zipcode,
			0,
			false,
			address.fullAddress,
		)
		await shopPage.addProductsToCart(6, mobile)
		var cartTotals = await cartPage.verifyCart(address.zipcode)
		await checkOutPage.confirmCheckout(address.zipcode, cartTotals, 0)
	})
})
