import { expect, test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CartPage } from '../../models/cart-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { MyAccountPage } from '../../models/my-account-page'

type CartTimerState = 'ca' | 'co' | 'mi' | 'nj'

function getCartTimerState(): CartTimerState {
	const envId = (process.env.ENV_ID || '').toLowerCase()
	const baseUrl = (process.env.BASE_URL || '').toLowerCase()

	if (/(^|-)co($|-)/.test(envId) || baseUrl.includes('thelist-co')) {
		return 'co'
	}

	if (/(^|-)mi($|-)/.test(envId) || baseUrl.includes('thelist-mi')) {
		return 'mi'
	}

	if (/(^|-)nj($|-)/.test(envId) || baseUrl.includes('thelist-nj')) {
		return 'nj'
	}

	return 'ca'
}

async function addCartTimerAddress(myAccountPage: MyAccountPage) {
	switch (getCartTimerState()) {
		case 'co':
			await myAccountPage.addColoradoAddress()
			return
		case 'mi':
			await myAccountPage.addAddress('123 Eight Mile Rd', 'Detroit', 'MI', '48203')
			return
		case 'nj':
			await myAccountPage.addAddress('13 Huntley Rd', 'Summit City', 'NJ', '07901')
			return
		default:
			await myAccountPage.addAddress()
	}
}

test('Cart Timer Is Visible @MI @CA @CO @NJ', async ({ page, browserName, qaClient }, workerInfo) => {
	//Arrange

	//Setup Pages
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const createAccountPage = new CreateAccountPage(page, qaClient)
	const loginPage = new LoginPage(page)
	const myAccountPage = new MyAccountPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')
	var mobile = workerInfo.project.name === 'Mobile Chrome' ? true : false

	await ageGatePage.passAgeGate()
	await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
	const user = await createAccountPage.createApi('recreational', 'current')
	await loginPage.login(user.email, user.password)
	await addCartTimerAddress(myAccountPage)

	//Act
	await shopPage.addProductsToCart(6, mobile, 'Pickup', 'recreational')

	//Assert
	await cartPage.cartCounter.waitFor()
	await expect(cartPage.cartCounter).toContainText('Your cart is reserved for')
})
