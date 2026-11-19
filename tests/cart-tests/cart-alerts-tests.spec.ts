import { expect, test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CartPage } from '../../models/cart-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { MyAccountPage } from '../../models/my-account-page'
import { buildListOrderCart } from '../../support/list-order-cart'

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
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const createAccountPage = new CreateAccountPage(page, qaClient)
	const loginPage = new LoginPage(page)
	const myAccountPage = new MyAccountPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')

	await ageGatePage.passAgeGate()
	await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
	const user = await createAccountPage.createApi('recreational', 'current')
	await loginPage.login(user.email, user.password)
	await addCartTimerAddress(myAccountPage)

	if (new URL(page.url()).hostname !== 'thelist-dev.710labs.com') {
		await shopPage.addProductsToCart(1, false, 'Pickup', 'recreational', { exactItemCount: true })
		await expect(cartPage.cartCounter).toContainText('Your cart is reserved for')
		return
	}

	try {
		await buildListOrderCart(shopPage, cartPage, 'Pickup', { initialItemCount: 1 })
		await page.goto('/')
		const shopUrl = new URL(page.url())
		const checkoutUrl = new URL('/checkout/', shopUrl)
		const isCheckout = (url: URL) => url.origin === shopUrl.origin && /^\/checkout\/?$/.test(url.pathname)
		const timerBar = page.locator('.rsp-zone__inner:visible')
		const countdown = timerBar.locator('.rsp-zone__time')

		await test.step('Verify the reservation timer and open checkout from its bar', async () => {
			const label = timerBar.locator('.rsp-zone__label--held')
			await expect(label).toBeVisible()
			await expect(label).toHaveText('Items held for')
			await expect(countdown).toBeVisible()
			await expect(countdown).toHaveText(/^\d{1,2}:[0-5]\d$/)

			const shortcut = timerBar.getByRole('link', { name: 'Checkout', exact: true })
			await expect(shortcut).toHaveJSProperty('href', checkoutUrl.href)
			await shortcut.click()
			await expect(page).toHaveURL(isCheckout)
			await expect(page.locator('.woocommerce-checkout-review-order-table')).toBeVisible()
		})

		await test.step('Return to the shop and proceed to checkout through the cart', async () => {
			await page.goBack()
			await expect(page).toHaveURL(shopUrl.href)
			await expect(countdown).toBeVisible()
			await shopPage.goToCart({ requireItems: true })
			await cartPage.goToCheckout()
			await expect(page).toHaveURL(isCheckout)
		})
	} finally {
		await shopPage.clearStorefrontCart()
	}
})
