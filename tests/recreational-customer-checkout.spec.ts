import { test, expect, devices } from '@playwright/test'
import { ListPasswordPage } from '../models/list-password-protect-page'
import { AgeGatePage } from '../models/age-gate-page'
import { LoginPage } from '../models/login-page'
import { ShopPage } from '../models/shop-page'
import { CreateAccountPage } from '../models/create-account-page'
import { v4 as uuidv4 } from 'uuid'
import { CheckoutPage } from '../models/checkout-page'
import { CartPage } from '../models/cart-page'

test.describe('Recreational Customer Checkout', () => {
	test(`Checkout Existing Customer #recreational`, async ({ page, browserName }, workerInfo) => {
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page)
		const loginPage = new LoginPage(page)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, browserName, workerInfo, 0)
		const checkOutPage = new CheckoutPage(page)

		await ageGatePage.passAgeGate()
		var user = await createAccountPage.createApi('recreational', 'current')
		await listPassword.submitPassword('qatester')
		await loginPage.login(user.email, user.password)
		await shopPage.addProductsToCart(6)
		var cartTotals = await cartPage.verifyCart(`94020`)
		await checkOutPage.confirmCheckout('94020', cartTotals, 0)
	})
	test(`Checkout New Customer #recreational`, async ({ page, browserName }, workerInfo) => {
		const ageGatePage = new AgeGatePage(page)
		const listPassword = new ListPasswordPage(page)
		const createAccountPage = new CreateAccountPage(page)
		const shopPage = new ShopPage(page, browserName, workerInfo)
		const cartPage = new CartPage(page, browserName, workerInfo, 0)
		const checkOutPage = new CheckoutPage(page)

		await ageGatePage.passAgeGate()
		await listPassword.submitPassword('qatester')
		await createAccountPage.create(`test+${uuidv4()}@710labs.com`, 'test1234!', '90210', 0)
		await shopPage.addProductsToCart(6)
		var cartTotals = await cartPage.verifyCart(`90210`)
		await checkOutPage.confirmCheckout(`90210`, cartTotals, 0)
	})
})
