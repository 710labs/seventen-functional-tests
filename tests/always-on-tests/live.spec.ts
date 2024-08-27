import { test, expect } from '@playwright/test'
import { HomePageLogin } from '../../models/always-on/live-homepage-login.ts'
import { HomePageCartActions } from '../../models/always-on/homepage-actions.ts'

test.describe('Always On Tests', () => {
	test.setTimeout(60000) // Set the timeout for all tests in this file
	test.describe.configure({ mode: 'parallel' })
	test('Verify Live shop page loads', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		// Verify that store homepage loads
		await homePageLogin.verifyShopLoadsBeforeSignIn(page)
	})
	test('Sign In existing user', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		// Verify that store homepage loads
		await homePageLogin.verifyShopLoadsBeforeSignIn(page)
		// log in existing user
		await homePageLogin.loginExistingUser(page)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
	})
	test('Register New User', async ({ page }) => {
		const homePageLogin = new HomePageLogin(page)
		// Verify that store homepage loads
		await homePageLogin.verifyShopLoadsBeforeSignIn(page)
		// log in existing user
		await homePageLogin.registerNewUser(page)
		await homePageLogin.verifyShopLoadsAfterSignIn(page)
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
