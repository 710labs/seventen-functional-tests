import { test, expect } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'
import { CheckoutPage } from '../../models/always-on/checkout-page.ts'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation.ts'
import { ConciergeLogin } from '../../models/concierge/concierge-login.ts'
import { ConciergeCreateUser } from '../../models/concierge/concierge-create-user.ts'
require('dotenv').config('.env')

test.describe('Concierge Tests', () => {
	test.setTimeout(200000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	const conciergeURL = process.env.CONCIERGE_URL || ''
	const conciergeUsername = process.env.CONCIERGE_USER || ''
	const conciergePassword = process.env.CONCIERGE_PASSWORD || ''
	const NEWalwaysOnPassword = process.env.NEW_ALWAYS_ON_PASSWORD || ''
	console.log(`------- \n URL being tested: ${conciergeURL} -------- \n `)
	test('Existing user -- Sign In & Sign Out', { tag: ['@recreational'] }, async ({ page }) => {
		const conciergeLogin = new ConciergeLogin(page)
		const accountPage = new AccountPage(page)

		const homePageLogin = new HomePageLogin(page)
		// log in existing user
		await conciergeLogin.loginUser(page, 'wrongpassword', conciergeUsername, conciergePassword)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		await accountPage.logOut(page)
	})
	test(
		'Rec New User - Happy Path test - Create New User, Place Order, Update Account Details, Re-Log In with New Creds',
		{ tag: ['@recreational'] },
		async ({ page }) => {
			const conciergeLogin = new ConciergeLogin(page)
			const homePageLogin = new HomePageLogin(page)
			const homePageActions = new HomePageActions(page)
			const checkoutPage = new CheckoutPage(page)
			const orderConfirmation = new OrderConfirmationPage(page)
			const conciergeCreateUser = new ConciergeCreateUser(page)
			const accountPage = new AccountPage(page)

			const now = new Date()
			// Construct the timestamp string with date and time
			const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
				2,
				'0',
			)}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(
				2,
				'0',
			)}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(
				2,
				'0',
			)}-${String(now.getMilliseconds()).padStart(3, '0')}`
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
			// login admin to WP dashboard
			await conciergeCreateUser.loginAdmin(page)
			//create new user as admin
			await conciergeCreateUser.createNewUser(page, newEmail, conciergePassword)
			//login to shop as new user
			await conciergeLogin.loginUser(page, 'wrongpassword', newEmail, conciergePassword)
			//verify that shop loads upon log in
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			// add adress for new user account
			const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			const newAddress = '2919 S La Cienega Blvd, Culver City, CA'
			await homePageActions.enterAddress(page, 'concierge', address)
			// verify that homepage loads again
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			// add products to cart
			await homePageActions.conciergeRecAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			await checkoutPage.recEnterInfoForCheckoutAndEdit(page, address, newAddress)
			//place order
			await checkoutPage.placeOrder(page)
			// verify order confirmation loads
			await orderConfirmation.verifyOrderConfirmationPageLoads(page)
			// go to account page
			await accountPage.goToAccountPage()
			// verify that account page elements, buttons, and popup actions all work
			const updatedEmail = await accountPage.verifyAccountPageElements(
				'rec',
				false,
				conciergePassword,
				NEWalwaysOnPassword,
			)
			//log out
			await accountPage.logOut(page)
			// sign in with NEW password that was just updated
			await conciergeLogin.loginUser(page, conciergePassword, updatedEmail, NEWalwaysOnPassword)
		},
	)
	test(
		'MED New User - Happy Path test - Create New User, Place Order, Update Account Details, Re-Log In with New Creds',
		{ tag: ['@medical'] },
		async ({ page }) => {
			const conciergeLogin = new ConciergeLogin(page)
			const homePageLogin = new HomePageLogin(page)
			const homePageActions = new HomePageActions(page)
			const checkoutPage = new CheckoutPage(page)
			const orderConfirmation = new OrderConfirmationPage(page)
			const conciergeCreateUser = new ConciergeCreateUser(page)
			const accountPage = new AccountPage(page)

			const now = new Date()
			// Construct the timestamp string with date and time
			const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
				2,
				'0',
			)}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(
				2,
				'0',
			)}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(
				2,
				'0',
			)}-${String(now.getMilliseconds()).padStart(3, '0')}`
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
			const newPassword = process.env.CONCIERGE_PASSWORD || ''
			// login admin to WP dashboard
			await conciergeCreateUser.loginAdmin(page)
			//create new user as admin
			await conciergeCreateUser.createNewUser(page, newEmail, conciergePassword)
			//login to shop as new user
			await conciergeLogin.loginUser(page, 'wrongpassword', newEmail, newPassword)
			//verify that shop loads upon log in
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			const newAddress = '2919 S La Cienega Blvd, Culver City, CA 90232'
			// add adress for new user account
			await homePageActions.enterAddress(page, 'concierge', address)
			// verify that homepage loads again
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			// add products to cart
			await homePageActions.conciergeMedAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			await checkoutPage.newMedEnterInfoForCheckoutAndEdit(page, conciergeURL, address, newAddress)
			//place order
			await checkoutPage.placeOrder(page)
			// verify order confirmation loads
			await orderConfirmation.verifyOrderConfirmationPageLoads(page)
			// go to account page
			await accountPage.goToAccountPage()
			// verify that account page elements, buttons, and popup actions all work
			const updatedEmail = await accountPage.verifyAccountPageElements(
				'med',
				false,
				conciergePassword,
				NEWalwaysOnPassword,
			)
			//log out
			await accountPage.logOut(page)
			// sign in with NEW password that was just updated
			await conciergeLogin.loginUser(page, conciergePassword, updatedEmail, NEWalwaysOnPassword)
		},
	)
})
