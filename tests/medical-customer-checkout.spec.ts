import { test, expect, devices } from '@playwright/test'
import { ListPasswordPage } from '../models/list-password-protect-page'
import { AgeGatePage } from '../models/age-gate-page'
import { LoginPage } from '../models/login-page'
import { ShopPage } from '../models/shop-page'
import { CreateAccountPage } from '../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../models/checkout-page'
import { CartPage } from '../models/cart-page'

test.describe('Medical Customer Checkout', () => {
	test(`Checkout Existing Customer #medical`, async ({ page, browserName }, workerInfo) => {
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page)
		const loginPage = new LoginPage(page)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page)

		await ageGatePage.passAgeGate()
		var user = await createAccountPage.createApi('medical', 'current')
		await listPassword.submitPassword('qatester')
		await loginPage.login(user.email, user.password)
		await shopPage.addProductsToCart(6)
		var cartTotals = await cartPage.verifyCart(`94020`)
		await checkOutPage.confirmCheckout('94020', cartTotals, 1)
	})
	test(`Checkout New Customer #medical`, async ({ page, browserName }, workerInfo) => {
		const zipCode = '94020'
		const email = `test+${uuidv4()}@710labs.com`
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, browserName, workerInfo, 1)
		const checkOutPage = new CheckoutPage(page)

		await ageGatePage.passAgeGate()
		await listPassword.submitPassword('qatester')
		await createAccountPage.create(email, 'test1234', zipCode, 1)
		await shopPage.addProductsToCart(6)
		var cartTotals = await cartPage.verifyCart(zipCode)
		await checkOutPage.confirmCheckout(zipCode, cartTotals, 1)
	})
})
