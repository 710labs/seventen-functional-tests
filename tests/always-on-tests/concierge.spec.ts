import { test, expect } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'
import { CheckoutPage } from '../../models/always-on/checkout-page.ts'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation.ts'
import { ConciergeLogin } from '../../models/concierge/concierge-login.ts'
import { ConciergeCreateUser } from '../../models/concierge/concierge-create-user.ts'

test.describe('Concierge Tests', () => {
	test.setTimeout(60000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	test('Existing user -- Sign In & Sign Out', async ({ page }) => {
		const conciergeLogin = new ConciergeLogin(page)
		const accountPage = new AccountPage(page)

		const homePageLogin = new HomePageLogin(page)
		// log in existing user
		await conciergeLogin.loginExistingUser(page)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		await accountPage.logOut(page)
	})
	test('Rec New User - Happy Path test - Create New User & Checkout', async ({ page }) => {
		const conciergeLogin = new ConciergeLogin(page)
		const homePageLogin = new HomePageLogin(page)
		const homePageActions = new HomePageActions(page)
		const checkoutPage = new CheckoutPage(page)
		const orderConfirmation = new OrderConfirmationPage(page)
		const conciergeCreateUser = new ConciergeCreateUser(page)

		const now = new Date()
		// Construct the timestamp string with date and time
		const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
			now.getDate(),
		).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(
			now.getMinutes(),
		).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(
			now.getMilliseconds(),
		).padStart(3, '0')}`
		// set device type for name
		const viewportSize = await page.viewportSize()
		let deviceType
		if (viewportSize.width <= 768) {
			deviceType = 'mobile'
		} else {
			deviceType = 'desktop'
		}
		// enter a unique test email for test user
		const newEmail = `test_auto_rec_${timestamp}_${deviceType}@test.com`
		const newPassword = `Test710!`
		// login admin to WP dashboard
		await conciergeCreateUser.loginAdmin(page)
		//create new user as admin
		await conciergeCreateUser.createNewUser(page, newEmail, newPassword)
		//login to shop as new user
		await conciergeLogin.loginNewUserCreated(page, newEmail, newPassword)
		//verify that shop loads upon log in
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		// add adress for new user account
		await homePageActions.enterAddress(page, 'concierge')
		// verify that homepage loads again
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		// add products to cart
		await homePageActions.recAddProductsToCartUntilMinimumMet(page)
		// verify that checkout page loads
		await checkoutPage.verifyCheckoutPageLoads(page)
		// enter in user info on checkoutpage
		await checkoutPage.enterInfoForCheckout(page)
		// verify order confirmation loads
		await orderConfirmation.verifyOrderConfirmationPageLoads(page)
	})
	test('MED New User - Happy Path test - Create New User & Checkout', async ({ page }) => {
		const conciergeLogin = new ConciergeLogin(page)
		const homePageLogin = new HomePageLogin(page)
		const homePageActions = new HomePageActions(page)
		const checkoutPage = new CheckoutPage(page)
		const orderConfirmation = new OrderConfirmationPage(page)
		const conciergeCreateUser = new ConciergeCreateUser(page)

		const now = new Date()
		// Construct the timestamp string with date and time
		const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
			now.getDate(),
		).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(
			now.getMinutes(),
		).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(
			now.getMilliseconds(),
		).padStart(3, '0')}`
		// set device type for name
		const viewportSize = await page.viewportSize()
		let deviceType
		if (viewportSize.width <= 768) {
			deviceType = 'mobile'
		} else {
			deviceType = 'desktop'
		}
		// enter a unique test email for test user
		const newEmail = `test_auto_med_${timestamp}_${deviceType}@test.com`
		const newPassword = `Test710!`
		// login admin to WP dashboard
		await conciergeCreateUser.loginAdmin(page)
		//create new user as admin
		await conciergeCreateUser.createNewUser(page, newEmail, newPassword)
		//login to shop as new user
		await conciergeLogin.loginNewUserCreated(page, newEmail, newPassword)
		//verify that shop loads upon log in
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		// add adress for new user account
		await homePageActions.enterAddress(page, 'concierge')
		// verify that homepage loads again
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		// add products to cart
		await homePageActions.medAddProductsToCartUntilMinimumMet(page)
		// verify that checkout page loads
		await checkoutPage.verifyCheckoutPageLoads(page)
		// enter in user info on checkoutpage
		await checkoutPage.enterInfoForCheckout(page)
		// verify order confirmation loads
		await orderConfirmation.verifyOrderConfirmationPageLoads(page)
	})
})
