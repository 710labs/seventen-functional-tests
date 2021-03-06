import { test, expect, devices, request } from '@playwright/test'
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
import zipcodes from '../utils/zipcodes-fl.json'

test.describe('Medical Customer Checkout Florida', () => {
	test(`Checkout New Customer Florida #medical @FL`, async ({ page, browserName }, workerInfo) => {
		const apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
		const address = "3275 NW 24th Street Rd"
		var index = await Math.floor(Math.random() * (zipcodes.length - 0) + 0)
		const zipCode = zipcodes[index]
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
		await createAccountPage.create(email, 'test1234', zipCode, 1, false, '123 Main Street','FL')
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
			await myAccountPage.addAddress(address, 'Miami', '1234567890', 'FL')
		}
		await shopPage.addProductsToCart(6)
		var cartTotals = await cartPage.verifyCart(zipCode)
		await checkOutPage.confirmCheckout(zipCode, cartTotals, 1, true, address)
		await schedulingPage.scheduleDelivery()
	})
})
