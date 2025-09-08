import { test, expect, request, APIRequestContext } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'
import { CheckoutPage } from '../../models/always-on/checkout-page.ts'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation.ts'
require('dotenv').config('.env')
import { appendFileSync, writeFileSync } from 'fs'

test.describe('Live Tests', () => {
	test.setTimeout(400000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	var apiContext: APIRequestContext
	const liveURL = process.env.ALWAYS_ON_URL || ''
	const alwaysOnUsername = process.env.ALWAYS_ON_USERNAME || ''
	const alwaysOnPassword = process.env.ALWAYS_ON_PASSWORD || ''
	const NEWalwaysOnPassword = process.env.NEW_ALWAYS_ON_PASSWORD || ''
	const VISUAL = process.env.VISUAL === '1'

	test.beforeEach(async ({ page }) => {
		if (!VISUAL) return
		await page.addStyleTag({
			content:
				'*, *::before, *::after { animation: none !important; transition: none !important; } input, textarea { caret-color: transparent !important; }',
		})
	})

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
			// add adress for new user account
			await homePageLogin.navigateToURL(page, liveURL)
			if (VISUAL) {
				await expect(page).toHaveScreenshot('homepage-shop-prelogin-rec.png')
			}
			await homePageActions.enterAddress(page, 'live', '440 Rodeo Drive Beverly Hills')

			// Verify that store homepage loads
			await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
			await homePageActions.addSingleProductToCart(page)
			if (VISUAL) {
				await expect(homePageLogin.userPopUpContainer).toBeVisible()
				await expect(homePageLogin.userPopUpContainer).toHaveScreenshot('auth-gateway-rec.png', {
					mask: [homePageLogin.passwordFieldPopUp],
				})
			}
			// register new user
			await homePageLogin.registerNewUser(page, 'rec')
			// go to main store page
			await homePageActions.goToMainStorePage(page)
			// // add adress for new user account
			//await homePageActions.enterAddress(page, 'live', '440 Rodeo Drive Beverly Hills')
			// verify that homepage loads again
			await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)
			if (VISUAL) {
				await expect(homePageLogin.shopByStoreTitle).toBeVisible()
				await expect(page).toHaveScreenshot('homepage-post-login-rec.png')
			}
			// add products to cart
			await homePageActions.liveRecAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			if (VISUAL) {
				await expect(checkoutPage.yourInfoSection).toHaveScreenshot('checkout-your-info-rec.png', {
					mask: [
						checkoutPage.phoneInputField,
						checkoutPage.birthdayInputField,
						checkoutPage.firstNameField,
						checkoutPage.lastNameField,
						checkoutPage.emailField,
					],
				})
			}
			// enter in user info on checkoutpage
			const address = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			const newAddress = '2919 S La Cienega Blvd, Culver City, CA'
			await checkoutPage.recEnterInfoForCheckoutAndEdit(page, address, newAddress)
			if (VISUAL) {
				// const timeMask = page.locator('#render_appt_summary p').nth(1)
				// await expect(checkoutPage.displayedAppointment).toHaveScreenshot(
				// 	'checkout-appointment-summary-rec.png',
				// 	// { mask: [timeMask] },
				// )
				await expect(page).toHaveScreenshot('checkout-payment-cash-rec.png')
			}
			//place order
			await checkoutPage.placeOrder(page)
			// verify order confirmation loads
			//TODO: Add Verification to details on order confirmation page
			await orderConfirmation.verifyOrderConfirmationPageLoads(page)
			if (VISUAL) {
				//await expect(page).toHaveScreenshot('order-confirmed.png')
				await expect(page).toHaveScreenshot('confirmation-page-rec.png', {
					mask: [orderConfirmation.orderNumber],
				})
			}
			// get order number to confirm order was created
			var orderNumber: any
			orderNumber = await orderConfirmation.getOrderNumber()
			await expect(orderNumber, 'Failed to create order').not.toBeNull()
			//write order number to file to use for cancel order via API
			appendFileSync('order_ids.txt', `${orderNumber}\n`, { encoding: 'utf-8' })
			console.log(`✅ Appended order_ids.txt → ${orderNumber}`)
			// go to account page
			await accountPage.goToAccountPage()
			if (VISUAL) {
				// Capture only the Personal info section header (h3 + link) to reduce flakiness
				const personalInfoHeader = accountPage.personalInfoHeaderContainer
				await expect(personalInfoHeader).toBeVisible()
				await expect(page).toHaveScreenshot('account-page-rec.png')
			}
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
			//await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
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
			// add adress for new user account
			await homePageLogin.navigateToURL(page, liveURL)
			await homePageActions.enterAddress(page, 'live', '440 Rodeo Drive Beverly Hills')

			// Verify that store homepage loads
			await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
			if (VISUAL) {
				await expect(homePageLogin.shopByCategoryTitle).toHaveScreenshot(
					'home-shop-by-category-med.png',
				)
			}
			await homePageActions.addSingleProductToCart(page)
			if (VISUAL) {
				await expect(homePageLogin.userPopUpContainer).toBeVisible()
				await expect(homePageLogin.userPopUpContainer).toHaveScreenshot('auth-gateway-med.png', {
					mask: [homePageLogin.passwordFieldPopUp],
				})
			}
			// register new user
			await homePageLogin.registerNewUser(page, 'med')
			// go to main store page
			await homePageActions.goToMainStorePage(page)
			const address = '2919 S La Cienega Blvd, Culver City, CA 90232'
			const newAddress = '440 N Rodeo Dr, Beverly Hills, CA 90210'
			// add adress for new user account
			//await homePageActions.enterAddress(page, 'live', address)
			// verify that homepage loads again
			await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)
			if (VISUAL) {
				await expect(homePageLogin.shopByStoreTitle).toBeVisible()
				await expect(homePageLogin.shopByStoreTitle).toHaveScreenshot(
					'home-post-login-title-med.png',
				)
			}
			// add products to cart
			await homePageActions.liveMedAddProductsToCartUntilMinimumMet(page, 'dev/stage')
			//await homePageActions.newLiveMedAddProductsToCartUntilMinimumMet(page)
			// verify that checkout page loads
			await checkoutPage.verifyCheckoutPageLoads(page)
			if (VISUAL) {
				await expect(checkoutPage.yourInfoSection).toHaveScreenshot('checkout-your-info-med.png')
			}
			// enter in user info on checkoutpage
			await checkoutPage.newMedEnterInfoForCheckoutAndEdit(page, liveURL, address, newAddress)
			if (VISUAL) {
				// const timeMask = page.locator('#render_appt_summary p').nth(1)
				// await expect(checkoutPage.displayedAppointment).toHaveScreenshot(
				// 	'checkout-appointment-summary-med.png',
				// 	{ mask: [timeMask] },
				// )
				await expect(checkoutPage.paymentSection).toHaveScreenshot('checkout-payment-cash-med.png')
			}
			//place order
			await checkoutPage.placeOrder(page)
			// verify order confirmation loads
			//TODO: Add Verification to details on order confirmation page
			await orderConfirmation.verifyOrderConfirmationPageLoads(page)
			if (VISUAL) {
				await expect(orderConfirmation.orderConfirmationTitle).toHaveScreenshot(
					'order-confirmed-title-med.png',
				)
				// await expect(orderConfirmation.orderNumberElement).toHaveScreenshot(
				// 	'order-number-med.png',
				// 	{
				// 		mask: [orderConfirmation.orderNumber],
				// 	},
				// )
			}
			// get order number to confirm order was created
			var orderNumber: any
			orderNumber = await orderConfirmation.getOrderNumber()
			await expect(orderNumber, 'Failed to create order').not.toBeNull()
			//write order number to file to use for cancel order via API
			appendFileSync('order_ids.txt', `${orderNumber}\n`, { encoding: 'utf-8' })
			console.log(`✅ Appended order_ids.txt → ${orderNumber}`)
			// go to account page
			await accountPage.goToAccountPage()
			if (VISUAL) {
				// Capture only the Personal info section header (h3 + link)
				const personalInfoHeader = accountPage.personalInfoHeaderContainer
				await expect(personalInfoHeader).toBeVisible()
				await expect(personalInfoHeader).toHaveScreenshot('account-personal-info-header-med.png')
			}
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
			//await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
			await homePageActions.addSingleProductToCart(page)
			await homePageLogin.loginExistingUser(page, alwaysOnPassword, newEmail, NEWalwaysOnPassword)
		},
	)
	test('Existing user -- Sign In & Sign Out', { tag: ['@recreational'] }, async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		const accountPage = new AccountPage(page)
		const homePageActions = new HomePageActions(page)
		// add adress for new user account
		await homePageLogin.navigateToURL(page, liveURL)
		// Verify that store homepage loads
		//await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
		await homePageActions.addSingleProductToCart(page)
		if (VISUAL) {
			await expect(homePageLogin.userPopUpContainer).toBeVisible()
			await expect(homePageLogin.userPopUpContainer).toHaveScreenshot('auth-gateway-existing.png', {
				mask: [homePageLogin.passwordFieldPopUp],
			})
		}
		//
		// Verify that store homepage loads
		// log in existing user
		await homePageLogin.loginExistingUser(page, 'wrongpassword', alwaysOnUsername, alwaysOnPassword)
		//logout
		await accountPage.logOut(page)
	})
})
