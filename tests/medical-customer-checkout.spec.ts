import { test, expect, devices, request, APIRequestContext } from '@playwright/test'
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

test.describe('Medical Customer Checkout', () => {
	var apiContext: APIRequestContext
	test.beforeAll(async () => {
		apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
	})
	test(`Checkout Existing Customer #medical @CA`, async ({ page, browserName }, workerInfo) => {
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const myAccountPage = new MyAccountPage(page)
		const loginPage = new LoginPage(page)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page, apiContext)
		const schedulingPage = new SchedulingPage(page)

		await ageGatePage.passAgeGate()
		var user = await createAccountPage.createApi('medical', 'current')
		await listPassword.submitPassword('qatester')
		await loginPage.login(user.email, user.password)
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
			await myAccountPage.addAddress()
		}
		await shopPage.addProductsToCart(6, true)
		var cartTotals = await cartPage.verifyCart(`94020`)
		await checkOutPage.confirmCheckout('94020', cartTotals, 1)
		await schedulingPage.scheduleDelivery()
	})
	test(`Checkout New Customer #medical @CA`, async ({ page, browserName }, workerInfo) => {
		const zipCode = '94020'
		const email = `test+${uuidv4()}@710labs-test.com`
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page, apiContext)
		const myAccountPage = new MyAccountPage(page)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page, apiContext)
		const schedulingPage = new SchedulingPage(page)

		await ageGatePage.passAgeGate()
		await listPassword.submitPassword('qatester')
		await createAccountPage.create(email, 'test1234', zipCode, 1)
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
			await myAccountPage.addAddress()
		}
		await shopPage.addProductsToCart(6, true)
		var cartTotals = await cartPage.verifyCart(zipCode)
		await checkOutPage.confirmCheckout(zipCode, cartTotals, 1)
		await schedulingPage.scheduleDelivery()
	})
})
