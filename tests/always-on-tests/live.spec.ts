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
	const liveURL = process.env.ALWAYS_ON_URL || ''
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
			await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
			await homePageActions.addSingleProductToCart(page)
			// register new user
			await homePageLogin.registerNewUser(page, 'rec')
			// go to main store page
			await homePageActions.goToMainStorePage(page)
			await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)
			// add adress for new user account
			await homePageActions.enterAddress(page, 'live', '440 Rodeo Drive Beverly Hills')
			// verify that homepage loads again
			await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)
			// add products to cart
			await homePageActions.liveRecAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			const newAddress = '2919 S La Cienega Blvd, Culver City, CA'
			await checkoutPage.recEnterInfoForCheckoutAndEdit(page, address, newAddress)
			//place order
			await checkoutPage.placeOrder(page)
			// verify order confirmation loads
			//TODO: Add Verification to details on order confirmation page
			await orderConfirmation.verifyOrderConfirmationPageLoads(page)
			// go to account page
			await accountPage.goToAccountPage()
			// verify that account page elements, buttons, and popup actions all work
			const newEmail = await accountPage.verifyAccountPageElements(
				'rec',
				false,
				alwaysOnPassword,
				NEWalwaysOnPassword,
			)
			//log out
			await accountPage.logOut(page)
			// sign in with NEW password that was just updated
			// Re-prompt the sign in modal by adding a product to cart
			await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
			await homePageActions.addSingleProductToCart(page)
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
			await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
			await homePageActions.addSingleProductToCart(page)
			// register new user
			await homePageLogin.registerNewUser(page, 'med')
			// go to main store page
			await homePageActions.goToMainStorePage(page)
			await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)
			const address = '2919 S La Cienega Blvd, Culver City, CA 90232'
			const newAddress = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			// add adress for new user account
			await homePageActions.enterAddress(page, 'live', address)
			// verify that homepage loads again
			await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)
			// add products to cart
			await homePageActions.liveMedAddProductsToCartUntilMinimumMet(page, 'dev/stage')
			//await homePageActions.newLiveMedAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			await checkoutPage.newMedEnterInfoForCheckoutAndEdit(page, liveURL, address, newAddress)
			//place order
			await checkoutPage.placeOrder(page)
			// verify order confirmation loads
			//TODO: Add Verification to details on order confirmation page
			await orderConfirmation.verifyOrderConfirmationPageLoads(page)
			// go to account page
			await accountPage.goToAccountPage()
			// verify that account page elements, buttons, and popup actions all work
			const newEmail = await accountPage.verifyAccountPageElements(
				'med',
				false,
				alwaysOnPassword,
				NEWalwaysOnPassword,
			)
			//log out
			await accountPage.logOut(page)
			// sign in with NEW password that was just updated
			// Re-prompt the sign in modal by adding a product to cart
			await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
			await homePageActions.addSingleProductToCart(page)
			await homePageLogin.loginExistingUser(page, alwaysOnPassword, newEmail, NEWalwaysOnPassword)
		},
	)
	test('Existing user -- Sign In & Sign Out', { tag: ['@recreational'] }, async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		const accountPage = new AccountPage(page)
		const homePageActions = new HomePageActions(page)

		// Verify that store homepage loads
		await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
		await homePageActions.addSingleProductToCart(page)
		//
		//await homePageLogin.verifyUserSignInModalAppears(page, liveURL)
		// Verify that store homepage loads
		// log in existing user
		await homePageLogin.loginExistingUser(page, 'wrongpassword', alwaysOnUsername, alwaysOnPassword)
		//logout
		await accountPage.logOut(page)
	})
})
