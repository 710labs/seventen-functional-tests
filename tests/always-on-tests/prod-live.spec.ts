import { test, expect, request, APIRequestContext } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'
import { CheckoutPage } from '../../models/always-on/checkout-page.ts'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation.ts'
require('dotenv').config('.env')

test.describe('PROD Live Tests', () => {
	test.setTimeout(240000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	var apiContext: APIRequestContext
	const prodLiveURL = process.env.PROD_LIVE_URL || ''
	const prodLiveUsername = process.env.PROD_LIVE_REC_USERNAME || ''
	const prodLivePassword = process.env.PROD_LIVE_REC_PASSWORD || ''
	const NEWalwaysOnPassword = process.env.NEW_ALWAYS_ON_PASSWORD || ''

	console.log(`------- \n URL being tested: ${prodLiveURL} -------- \n `)
	test(
		'Prod Live check - EXISTING REC User - Happy Path test - Sign In, Add Products to Cart, but DO NOT CHECKOUT',
		{ tag: ['@medical'] },
		async ({ page }) => {
			const homePageLogin = new HomePageLogin(page)
			const homePageActions = new HomePageActions(page)
			const checkoutPage = new CheckoutPage(page)
			const accountPage = new AccountPage(page)
			//
			const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			const newAddress = '2919 S La Cienega Blvd, Culver City, CA'

			// Verify that store homepage loads
			await homePageLogin.verifyUserSignInModalAppears(page, prodLiveURL)

			await homePageLogin.navigateToURL(page, prodLiveURL)

			await homePageActions.enterAddress(page, 'live', address)

			// Verify that store homepage loads
			await homePageLogin.newTestverifyUserSignInModalAppears(page, prodLiveURL)
			await homePageActions.addSingleProductToCart(page)
			// Login Existing Prod User
			await homePageLogin.loginExistingUser(
				page,
				'wrongpassword',
				prodLiveUsername,
				prodLivePassword,
			)
			// go to main store page
			await homePageActions.goToMainStorePage(page)
			// clear items from user cart
			await homePageActions.clearProductsFromCart(page)
			// // add adress for new user account
			await homePageActions.openAddressSection(page, 'live')
			await homePageActions.selectAddressFromList(page, 'live', address)
			// verify that homepage loads again
			await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)
			//
			// CLEAR CART IF PRODUCTS EXIST
			await homePageActions.clearProductsFromCart(page)
			// add products to cart
			await homePageActions.liveRecAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			await checkoutPage.recExistingCheckoutAndEdit(page, address, newAddress)
			//
			// CANT HAVE PLACE ORDER // CLICK SUBMIT BUTTON SINCE THIS IS FOR PROD
			//
			// CLEAR CART TO KEEP CART EMPTY WHEN NOT IN USE
			await homePageActions.goToHomePage()
			await homePageActions.clearProductsFromCart(page)
			// logout
			await accountPage.logOut(page)
		},
	)
		// test(
		// 	'Prod Live check - EXISTING MED User - Happy Path test - Sign In, Add Products to Cart, but DO NOT CHECKOUT',
		// 	{ tag: ['@medical'] },
		// 	async ({ page }) => {
		// 		const homePageLogin = new HomePageLogin(page)
		// 		const homePageActions = new HomePageActions(page)
		// 		const checkoutPage = new CheckoutPage(page)
		// 		const accountPage = new AccountPage(page)
		// 		//
		// 		const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
		// 		const newAddress = '2919 S La Cienega Blvd, Culver City, CA'

		// 		// Verify that store homepage loads
		// 		await homePageLogin.verifyUserSignInModalAppears(page, prodLiveURL)

		// 		await homePageLogin.navigateToURL(page, prodLiveURL)

		// 		await homePageActions.enterAddress(page, 'live', address)

		// 		// Verify that store homepage loads
		// 		await homePageLogin.newTestverifyUserSignInModalAppears(page, prodLiveURL)
		// 		await homePageActions.addSingleProductToCart(page)
		// 		// Login Existing Prod User
		// 		await homePageLogin.loginExistingUser(
		// 			page,
		// 			'wrongpassword',
		// 			prodLiveUsername,
		// 			prodLivePassword,
		// 		)
		// 		// go to main store page
		// 		await homePageActions.goToMainStorePage(page)
		// 		// // add adress for new user account
		// 		//await homePageActions.enterAddress(page, 'live', '440 Rodeo Drive Beverly Hills')
		// 		// verify that homepage loads again
		// 		await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)
		// 		//
		// 		// CLEAR CART IF PRODUCTS EXIST
		// 		await homePageActions.clearProductsFromCart(page)
		// 		// add products to cart
		// 		await homePageActions.liveMedAddProductsToCartUntilMinimumMet(page, 'prod')
		// 		// verify that checkout page loads
		// 		await checkoutPage.verifyCheckoutPageLoads(page)
		// 		// enter in user info on checkoutpage
		// 		await checkoutPage.recExistingCheckoutAndEdit(page, address, newAddress)
		// 		//
		// 		// CANT HAVE PLACE ORDER // CLICK SUBMIT BUTTON SINCE THIS IS FOR PROD
		// 		//
		// 		// CLEAR CART TO KEEP CART EMPTY WHEN NOT IN USE
		// 		await homePageActions.goToHomePage()
		// 		await homePageActions.clearProductsFromCart(page)
		// 		// logout
		// 		await accountPage.logOut(page)
		// 	},
		// )
})
