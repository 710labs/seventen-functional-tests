import { APIRequestContext, request, test } from '@playwright/test'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CartPage } from '../../models/cart-page'

var apiContext: APIRequestContext
test.skip('Customer Has Credit - Discount Applied', async ({ page, browserName }, workerInfo) => {
	apiContext = await request.newContext({
		baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
		extraHTTPHeaders: {
			'x-api-key': `${process.env.API_KEY}`,
		},
	})
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const loginPage = new LoginPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
	var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

	//Arrange
	await ageGatePage.passAgeGate()
	await listPassword.submitPassword('qatester')
	await loginPage.login('account-credit-500@mail7.io', 'test1234!')

	//Act
	await shopPage.addProductsToCart(6, mobile)

	//Assert
	await cartPage.verifyCredit(500)
})

test.skip('Customer Has Credit - Order Total Equals Rec Limit - Discount Applied ', async ({
	page,
	browserName,
}, workerInfo) => {
	apiContext = await request.newContext({
		baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
		extraHTTPHeaders: {
			'x-api-key': `${process.env.API_KEY}`,
		},
	})
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const loginPage = new LoginPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, apiContext, browserName, workerInfo, 1)
	var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

	//Arrange
	await ageGatePage.passAgeGate()
	await listPassword.submitPassword('qatester')
	await loginPage.login('account-credit-300@mail7.io', 'test1234!')

	//Act
	await shopPage.addProductsToCart(6, mobile)

	//Assert
	await cartPage.verifyCredit(500)
})
