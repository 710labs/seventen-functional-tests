import { test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CartPage } from '../../models/cart-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { AdminLogin } from '../../models/admin/admin-login-page'

test.skip('Customer Has Credit - Discount Applied @CA', async ({
	page,
	browserName,
	qaClient,
}, workerInfo) => {
	//Arrange

	//Setup Pages
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const createAccountPage = new CreateAccountPage(page, qaClient)
	const loginPage = new LoginPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')
	const adminLoginPage = new AdminLogin(page)
	var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

	//Create Account
	var user = await createAccountPage.createApi('recreational', 'current')

	//Add Credit
	await adminLoginPage.login()

	await ageGatePage.passAgeGate()
	await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
	var user = await createAccountPage.createApi('recreational', 'current')
	await loginPage.login(user.email, user.password)

	//Act
	await shopPage.addProductsToCart(6, mobile, 'Delivery', 'recreational')

	//Assert
	await cartPage.verifyCredit(500)
})

test.skip('Customer Has Credit - Order Total Equals Rec Limit - Discount Applied ', async ({
	page,
	browserName,
	qaClient,
}, workerInfo) => {
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const loginPage = new LoginPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')
	var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

	//Arrange
	await ageGatePage.passAgeGate()
	await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
	await loginPage.login('account-credit-300@mail7.io', 'test1234!')

	//Act
	await shopPage.addProductsToCart(6, mobile, 'Delivery', 'recreational')

	//Assert
	await cartPage.verifyCredit(500)
})
