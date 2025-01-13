import { request, test, expect } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CartPage } from '../../models/cart-page'
import { CreateAccountPage } from '../../models/create-account-page'

test('Cart Timer Is Visible @MI @CA @CO @NJ', async ({ page, browserName }, workerInfo) => {
	//Arrange

	//Setup Pages
	const apiContext = await request.newContext({
		baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
		extraHTTPHeaders: {
			'x-api-key': `${process.env.API_KEY}`,
		},
	})
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const createAccountPage = new CreateAccountPage(page, apiContext)
	const loginPage = new LoginPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
	var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

	//Create Account
	var user = await createAccountPage.createApi('recreational', 'current')

	await ageGatePage.passAgeGate()
	await listPassword.submitPassword('qatester')
	var user = await createAccountPage.createApi('recreational', 'current')
	await loginPage.login(user.email, user.password)

	//Act
	await shopPage.addProductsToCart(6, mobile, 'Pickup')

	//Assert
	await cartPage.cartCounter.waitFor()
	await expect(cartPage.cartCounter).toContainText('Your cart is reserved for')
})
