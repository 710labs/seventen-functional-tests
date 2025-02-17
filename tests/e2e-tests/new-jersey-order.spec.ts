import { test, request, APIRequestContext } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../../models/checkout-page'
import { CartPage } from '../../models/cart-page'
import { MyAccountPage } from '../../models/my-account-page'

test.describe('NJ Order Tests', { tag: ['@NJ'] }, () => {
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
	test(
		`Basic Order - Existing Customer - Medical`,
		{ tag: ['@medical'] },
		async ({ page, browserName }, workerInfo) => {
			const address = '13 Huntley Rd'
			const city = 'Summit City'
			const state = 'NJ'
			const zipcode = '07901'
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, apiContext)
			const myAccountPage = new MyAccountPage(page)
			const loginPage = new LoginPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
			const checkOutPage = new CheckoutPage(page, apiContext)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			var user = await createAccountPage.createApi('medical', 'current')
			await listPassword.submitPassword('qatester')
			await loginPage.login(user.email, user.password)
			if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
				await myAccountPage.addAddress(address, city, state, zipcode)
			}
			await myAccountPage.addMedicalExp()

			await shopPage.addProductsToCart(6, mobile, 'Pickup', 'Medical')
			var cartTotals = await cartPage.verifyCart(zipcode)
			await checkOutPage.confirmCheckout(zipcode, cartTotals, 1)
		},
	)
	test(
		`Basic Order - New Customer - Medical`,
		{ tag: ['@medical'] },
		async ({ page, browserName }, workerInfo) => {
			const address = '13 Huntley Rd'
			const city = 'Summit City'
			const state = 'NJ'
			const zipcode = '07901'
			const email = `test+${uuidv4()}@710labs-test.com`
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, apiContext)
			const myAccountPage = new MyAccountPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
			const checkOutPage = new CheckoutPage(page, apiContext)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			await listPassword.submitPassword('qatester')
			await createAccountPage.create(email, 'test1234', zipcode, 1, false, address, state)
			if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
				await myAccountPage.addAddress(address, city, state, zipcode)
			}
			await shopPage.addProductsToCart(6, mobile, 'Pickup', 'Medical')
			var cartTotals = await cartPage.verifyCart(zipcode)
			await checkOutPage.confirmCheckout(zipcode, cartTotals, 1)
		},
	)
	test(
		`Basic Order - Existing Customer - Recreational`,
		{ tag: ['@recreational'] },
		async ({ page, browserName }, workerInfo) => {
			const address = '13 Huntley Rd'
			const city = 'Summit City'
			const state = 'NJ'
			const zipcode = '07901'
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, apiContext)
			const myAccountPage = new MyAccountPage(page)
			const loginPage = new LoginPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 0)
			const checkOutPage = new CheckoutPage(page, apiContext)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			var user = await createAccountPage.createApi('recreational', 'current')
			await listPassword.submitPassword('qatester')
			await loginPage.login(user.email, user.password)
			if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
				await myAccountPage.addAddress(address, city, state, zipcode)
			}
			await shopPage.addProductsToCart(6, mobile, 'Pickup', 'Recreational')
			var cartTotals = await cartPage.verifyCart(zipcode)
			await checkOutPage.confirmCheckout(zipcode, cartTotals, 0)
		},
	)
	test(
		`Basic Order - New Customer - Recreational`,
		{ tag: ['@recreational'] },
		async ({ page: page, browserName }, workerInfo) => {
			const address = '13 Huntley Rd'
			const city = 'Summit City'
			const state = 'NJ'
			const zipcode = '07901'
			const ageGatePage = new AgeGatePage(page)
			const listPassword = new ListPasswordPage(page)
			const createAccountPage = new CreateAccountPage(page, apiContext)
			const myAccountPage = new MyAccountPage(page)
			const shopPage = new ShopPage(page, browserName, workerInfo)
			const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 0)
			const checkOutPage = new CheckoutPage(page, apiContext)
			var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

			await ageGatePage.passAgeGate()
			await listPassword.submitPassword('qatester')
			await createAccountPage.create(
				`test+${uuidv4()}@710labs-test.com`,
				'test1234!',
				zipcode,
				0,
				false,
				address,
				state,
			)
			await shopPage.addProductsToCart(6, mobile, 'Pickup', 'Recreational')
			var cartTotals = await cartPage.verifyCart(zipcode)
			await checkOutPage.confirmCheckout(zipcode, cartTotals, 0)
		},
	)
})
