import { test, expect, request, APIRequestContext } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'
import { CheckoutPage } from '../../models/always-on/checkout-page.ts'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation.ts'
require('dotenv').config('.env')

test.describe('Live Tests', () => {
	test.setTimeout(240000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	var apiContext: APIRequestContext
	const liveURL = process.env.ALWAYS_ON_UR || ''
	const alwaysOnUsername = process.env.ALWAYS_ON_USERNAME || ''
	const alwaysOnPassword = process.env.ALWAYS_ON_PASSWORD || ''
	const NEWalwaysOnPassword = process.env.NEW_ALWAYS_ON_PASSWORD || ''

	console.log(`------- \n URL being tested: ${liveURL} -------- \n `)
	test(
		'Rec New User - Happy Path test - Register, Checkout, Update Account, & Re-Log In with New Creds',
		{ tag: ['@recreational'] },
		async ({ page }) => {
			const homePageLogin = new HomePageLogin(page)
			const homePageActions = new HomePageActions(page)
			const checkoutPage = new CheckoutPage(page)
			const orderConfirmation = new OrderConfirmationPage(page)
			const accountPage = new AccountPage(page)

			// Verify that store homepage loads
			await homePageLogin.verifyUserSignInModalAppears(page)
			// register new user
			await homePageLogin.registerNewUser(page, 'rec')
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			// add adress for new user account
			await homePageActions.enterAddress(page, 'live')
			// verify that homepage loads again
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			// add products to cart
			await homePageActions.liveRecAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			await checkoutPage.recEnterInfoForCheckoutAndEdit(page)
			// verify order confirmation loads
			//TODO: Add Verification to details on order confirmation page
			await orderConfirmation.verifyOrderConfirmationPageLoads(page)
			// go to account page
			await accountPage.goToAccountPage()
			// verify that account page elements, buttons, and popup actions all work
			const newEmail = await accountPage.verifyAccountPageElements('rec', false)
			//log out
			await accountPage.logOut(page)
			// sign in with NEW password that was just updated
			await homePageLogin.loginExistingUser(page, alwaysOnPassword, newEmail, NEWalwaysOnPassword)
		},
	)
	test(
		'MED New User - Happy Path test - Register, Checkout Med-Only Products, Update Account, & Re-Log In with New Creds',
		{ tag: ['@medical'] },
		async ({ page }) => {
			const homePageLogin = new HomePageLogin(page)
			const homePageActions = new HomePageActions(page)
			const checkoutPage = new CheckoutPage(page)
			const orderConfirmation = new OrderConfirmationPage(page)
			const accountPage = new AccountPage(page)

			// Verify that store homepage loads
			await homePageLogin.verifyUserSignInModalAppears(page)
			// register new user
			await homePageLogin.registerNewUser(page, 'med')
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			// add adress for new user account
			await homePageActions.enterAddress(page, 'live')
			// verify that homepage loads again
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			// add products to cart
			await homePageActions.liveMedAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			await checkoutPage.newMedEnterInfoForCheckoutAndEdit(page)
			// verify order confirmation loads
			//TODO: Add Verification to details on order confirmation page
			await orderConfirmation.verifyOrderConfirmationPageLoads(page)
			// go to account page
			await accountPage.goToAccountPage()
			// verify that account page elements, buttons, and popup actions all work
			const newEmail = await accountPage.verifyAccountPageElements('med', false)
			//log out
			await accountPage.logOut(page)
			// sign in with NEW password that was just updated
			await homePageLogin.loginExistingUser(page, alwaysOnPassword, newEmail, NEWalwaysOnPassword)
		},
	)
	test('Existing user -- Sign In & Sign Out', { tag: ['@recreational'] }, async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		const accountPage = new AccountPage(page)

		await homePageLogin.verifyUserSignInModalAppears(page)
		// Verify that store homepage loads
		// log in existing user
		await homePageLogin.loginExistingUser(page, 'wrongpassword', alwaysOnUsername, alwaysOnPassword)
		//logout
		await accountPage.logOut(page)
	})
})
