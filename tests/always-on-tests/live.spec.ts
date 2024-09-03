import { test, expect } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'

test.describe('Always On Tests', () => {
	test.setTimeout(60000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	test('Verify Live shop page loads', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		// Verify that store homepage loads
		await homePageLogin.verifyUserSignInModalAppears(page)
	})
	test('Sign In existing user', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		// Verify that store homepage loads
		await homePageLogin.verifyUserSignInModalAppears(page)
		// log in existing user
		await homePageLogin.loginExistingUser(page)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
	})
	test('Register New User', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		// Verify that store homepage loads
		await homePageLogin.verifyUserSignInModalAppears(page)
		// register new user
		await homePageLogin.registerNewUser(page)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
	})
	test('Sign Out Existing User', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		const accountPage = new AccountPage(page)

		// Verify that store homepage loads
		await homePageLogin.verifyUserSignInModalAppears(page)
		// log in existing user
		await homePageLogin.loginExistingUser(page)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		// log out user
		await accountPage.logOut(page)
		// verify that sign in modal appears again
		await homePageLogin.verifyUserSignInModalAppears(page)
	})
	test('Add address for New User', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		const homePageActions = new HomePageActions(page)

		// Verify that store homepage loads
		await homePageLogin.verifyUserSignInModalAppears(page)
		// register new user
		await homePageLogin.registerNewUser(page)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		// add adress
		await homePageActions.enterAddress(page)
		// verify that homepage loads again
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
	})
	test('Add Products to Cart - New User', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		const homePageActions = new HomePageActions(page)

		// Verify that store homepage loads
		await homePageLogin.verifyUserSignInModalAppears(page)
		// register new user
		await homePageLogin.registerNewUser(page)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		// add adress
		await homePageActions.enterAddress(page)
		// verify that homepage loads again
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
		// add products to cart
		await homePageActions.addProductsToCart(page, 4)
	})
})
