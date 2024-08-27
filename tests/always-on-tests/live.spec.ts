import { test, expect } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/live-homepage-login.ts'
import { AccountPage } from '../../models/always-on/account-page.ts'
import { HomePageCartActions } from '../../models/always-on/homepage-actions.ts'

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
	// test('Add Products to Cart', async ({ page }) => {
	// 	const homePageLogin = new HomePageLogin(page)
	// 	const homePageCartActions = new HomePageCartActions(page)

	// 	// Verify that store homepage loads
	// 	await homePageLogin.verifyShopLoadsBeforeSignIn(page)
	// 	// log in existing user
	// 	await homePageLogin.loginExistingUser(page)
	// 	await homePageLogin.verifyShopLoadsAfterSignIn(page)
	// 	await homePageCartActions.addProductsToCart(4)
	// })
})
