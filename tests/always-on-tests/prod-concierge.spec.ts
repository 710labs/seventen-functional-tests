import { test, expect, request, APIRequestContext } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'
import { CheckoutPage } from '../../models/always-on/checkout-page.ts'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation.ts'
import { ConciergeLogin } from '../../models/concierge/concierge-login.ts'
require('dotenv').config('.env')

test.describe('PROD CONCIERGE Tests', () => {
	test.setTimeout(240000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	var apiContext: APIRequestContext
	const prodConciergeURL = process.env.PROD_CONCIERGE_URL || ''
	const prodConciergeUsername = process.env.PROD_CONCIERGE_USERNAME || ''
	const prodConciergePassword = process.env.PROD_CONCIERGE_PASSWORD || ''
	const NEWalwaysOnPassword = process.env.NEW_ALWAYS_ON_PASSWORD || ''

	console.log(`------- \n URL being tested: ${prodConciergeURL} -------- \n `)
	test(
		'Prod Concierge check - MED EXISTING User - Happy Path test - Sign In, Add Products to Cart, but DO NOT CHECKOUT',
		{ tag: ['@medical'] },
		async ({ page }) => {
			const conciergeLogin = new ConciergeLogin(page)
			const homePageLogin = new HomePageLogin(page)
			const homePageActions = new HomePageActions(page)
			const checkoutPage = new CheckoutPage(page)
			const orderConfirmation = new OrderConfirmationPage(page)
			const accountPage = new AccountPage(page)
			await conciergeLogin.loginUser(
				page,
				prodConciergeURL,
				'wrongpassword',
				prodConciergeUsername,
				prodConciergePassword,
			)
			//verify that shop loads upon log in
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			const newAddress = '2919 S La Cienega Blvd, Culver City, CA'
			// add adress for new user account
			await homePageActions.openConciergeAddress(page)
			await homePageActions.selectAddressFromList(page, 'concierge', address)
			// verify that homepage loads again
			await homePageLogin.verifyShopLoadsAfterSignIn(page)
			//
			// CLEAR CART IF PRODUCTS EXIST
			await homePageActions.clearProductsFromCart(page)
			// add products to cart
			await homePageActions.conciergeRecAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			// enter in user info on checkoutpage
			await checkoutPage.recExistingCheckoutAndEdit(page, address, newAddress)

			// CLEAR CART TO KEEP CART EMPTY WHEN NOT IN USE
			await homePageActions.goToHomePage()
			await homePageActions.clearProductsFromCart(page)
			// logout
			await accountPage.logOut(page)
		},
	)
})
