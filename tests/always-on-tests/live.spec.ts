import { test, expect } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'
import { CheckoutPage } from '../../models/always-on/checkout-page.ts'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation.ts'

test.describe('Live Tests', () => {
	test.setTimeout(90000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	test('Rec New User - Happy Path test - Register & Checkout', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		const homePageActions = new HomePageActions(page)
		const checkoutPage = new CheckoutPage(page)
		const orderConfirmation = new OrderConfirmationPage(page)

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
		await checkoutPage.enterInfoForCheckout(page)
		// verify order confirmation loads
		await orderConfirmation.verifyOrderConfirmationPageLoads(page)
	})
	test('MED New User - Happy Path test - Register & Checkout Med-Only Products', async ({
		page,
	}) => {
		const homePageLogin = new HomePageLogin(page)
		const homePageActions = new HomePageActions(page)
		const checkoutPage = new CheckoutPage(page)
		const orderConfirmation = new OrderConfirmationPage(page)

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
		await checkoutPage.enterInfoForCheckout(page)
		// verify order confirmation loads
		await orderConfirmation.verifyOrderConfirmationPageLoads(page)
	})
	test('Existing user -- Sign In & Sign Out', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		const accountPage = new AccountPage(page)

		// Verify that store homepage loads
		await homePageLogin.verifyUserSignInModalAppears(page)
		// log in existing user
		await homePageLogin.loginExistingUser(page)
		await accountPage.logOut(page)
	})
})
