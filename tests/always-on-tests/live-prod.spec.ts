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
	const prodLiveURL = process.env.PROD_LIVE_URL || ''
	const prodLiveUsername = process.env.PROD_LIVE_USERNAME || ''
	const prodLivePassword = process.env.PROD_LIVE_PASSWORD || ''
	const NEWalwaysOnPassword = process.env.NEW_ALWAYS_ON_PASSWORD || ''

	console.log(`------- \n URL being tested: ${prodLiveURL} -------- \n `)
	test(
		'MED EXISTING User - Happy Path test - Sign In, Add Products to Cart, but DO NOT CHECKOUT',
		{ tag: ['@medical'] },
		async ({ page }) => {
			const homePageLogin = new HomePageLogin(page)
			const homePageActions = new HomePageActions(page)
			const checkoutPage = new CheckoutPage(page)
			const accountPage = new AccountPage(page)

			// Verify that store homepage loads
			await homePageLogin.verifyUserSignInModalAppears(page)
			// Login Existing Prod User
			await homePageLogin.loginExistingUser(
				page,
				'wrongpassword',
				prodLiveUsername,
				prodLivePassword,
			)

			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			const newAddress = '2919 S La Cienega Blvd, Culver City, CA'
			// add adress for new user account
			//await homePageActions.enterAddress(page, 'live', address)
			// verify that homepage loads again
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			//
			// TODO: CLEAR CART IF PRODUCTS EXIST
			await homePageActions.clearProductsFromCart(page)
			// add products to cart
			await homePageActions.liveMedAddProductsToCartUntilMinimumMet(page)
			//await homePageActions.newLiveMedAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			await checkoutPage.newMedEnterInfoForCheckoutAndEdit(page, prodLiveURL, address, newAddress)
			// verify order confirmation loads
			//
			//
			// ?????? go account page or?
			// go to account page
			// await accountPage.goToAccountPage()
			// // verify that account page elements, buttons, and popup actions all work
			// const newEmail = await accountPage.verifyAccountPageElements(
			// 	'med',
			// 	false,
			// 	alwaysOnPassword,
			// 	NEWalwaysOnPassword,
			// )
			// //log out
			// await accountPage.logOut(page)
			// // sign in with NEW password that was just updated
			// await homePageLogin.loginExistingUser(page, alwaysOnPassword, newEmail, NEWalwaysOnPassword)
			//
			//
			// logout
			await accountPage.logOut(page)
		},
	)
})
