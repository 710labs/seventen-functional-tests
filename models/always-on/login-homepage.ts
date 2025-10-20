require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class HomePageLogin {
	readonly alwaysOnUsername: string
	readonly alwaysOnPassword: string
	readonly page: Page
	readonly pageTitleSelector: Locator
	readonly accountButtonNav: Locator
	readonly cartButtonNav: Locator
	readonly userPopUpContainer: Locator
	readonly userPopUpContainerText: Locator
	readonly emailFieldPopUp: Locator
	readonly continueButtonPopUp: Locator
	readonly passwordFieldPopUp: Locator
	readonly signInButton: Locator
	readonly firstNameField: Locator
	readonly lastNameField: Locator
	readonly zipCodeField: Locator
	readonly createAccountButton: Locator
	readonly addToCartButtonGeneral: Locator
	readonly signInError: Locator
	// “Shop by Store” heading
	readonly shopByStoreTitle: Locator
	// first store card and specific store link
	readonly firstStoreCard: Locator

	// “Shop by Category” heading
	readonly shopByCategoryTitle: Locator
	// all category cards + a specific one
	readonly categoryCards: Locator
	readonly concentratesCard: Locator
	readonly flowerCard: Locator

	constructor(page: Page) {
		this.alwaysOnUsername = process.env.ALWAYS_ON_USERNAME || ''
		this.alwaysOnPassword = process.env.ALWAYS_ON_PASSWORD || ''
		this.page = page
		this.pageTitleSelector = page.locator('span.site-header-group')
		this.accountButtonNav = page.locator('svg.icon.icon-account').first()
		this.cartButtonNav = page.locator('a.wpse-cart-openerize').first()
		this.userPopUpContainer = page.locator('section.wpse-component #renderGateway')
		this.userPopUpContainerText = page.locator('section.wpse-component #renderGateway header h2')
		this.emailFieldPopUp = page.locator('#fasd_email')
		this.continueButtonPopUp = page.locator('button:has-text("Continue")')
		this.passwordFieldPopUp = page.locator('input.fasd-form-value#password')
		this.signInButton = page.locator('button:has-text("Sign in")')
		this.firstNameField = page.locator('input.fasd-form-value#reg_fname')
		this.lastNameField = page.locator('input.fasd-form-value#reg_lname')
		this.zipCodeField = page.locator('input.fasd-form-value#reg_postcode')
		this.createAccountButton = page.locator('button:has-text("Create Account")')
		this.addToCartButtonGeneral = page.locator('button[aria-label="Add product to cart"]')
		this.signInError = page.locator('.wpse-snacktoast-headline')
		// Shop by Store
		this.shopByStoreTitle = page.locator('h1.shop-category-head:has-text("Shop by Store")')
		this.firstStoreCard = page.locator('li.wpse-detailed-radio').first()
		// Shop by Category
		this.shopByCategoryTitle = page.locator('h1.shop-category-head:has-text("Shop by Category")')
		this.concentratesCard = page.locator('li.wpse-category-button:has-text("Concentrates")')
		this.flowerCard = page.locator('li.wpse-category-button:has-text("Flower")')
	}

	async navigateToURL(page, URLparam) {
		await page.goto(URLparam)
		await page.waitForTimeout(5000)
		await this.pageTitleSelector.waitFor({ state: 'visible' })
	}
	async verifyUserSignInModalAppears(page, URLparam) {
		await test.step('Verify the Homepage loads correctly', async () => {
			//go to page
			await page.goto(URLparam)
			// verify that email login/signup popup appears and that correct text displays
			await this.userPopUpContainer.waitFor({ state: 'visible' })
			await expect(this.userPopUpContainer).toBeVisible()
			await expect(this.userPopUpContainerText).toBeVisible()
			const popUpText = await this.userPopUpContainerText.textContent()
			expect(popUpText).toBe('Shop 710 Labs from dispensaries near you.')
			//verify that email field appears
			await expect(this.emailFieldPopUp).toBeVisible()
			await expect(this.continueButtonPopUp).toBeVisible()
		})
	}
	// new test for user not need to sign in
	async newTestverifyUserSignInModalAppears(page, URLparam) {
		await test.step('Verify the Homepage loads correctly', async () => {
			//verif that main store page loads
			// // verify page title, logo, account and cart button are visible
			await this.pageTitleSelector.waitFor({ state: 'visible' })
			await expect(this.pageTitleSelector).toBeVisible()
			await expect(this.accountButtonNav).toBeVisible()
			await expect(this.cartButtonNav).toBeVisible()
			// Verify that Shop by Store displays
			// await expect(this.shopByStoreTitle).toBeVisible()
			// await expect(this.firstStoreCard).toBeVisible()
			await expect(this.shopByCategoryTitle).toBeVisible()
			await expect(this.concentratesCard).toBeVisible()
			await expect(this.flowerCard).toBeVisible()
			// click on Product and then add to cart to prompt sign in modal
			// const products = await page.locator(
			// 	'li.product.type-product.product-type-simple.status-publish',
			// )
			// await products.first().click()

			// // verify that email login/signup popup appears and that correct text displays
			// await this.userPopUpContainer.waitFor({ state: 'visible' })
			// await expect(this.userPopUpContainer).toBeVisible()
			// await expect(this.userPopUpContainerText).toBeVisible()
			// const popUpText = await this.userPopUpContainerText.textContent()
			// expect(popUpText).toBe('Shop 710 Labs from dispensaries near you.')
			// //verify that email field appears
			// await expect(this.emailFieldPopUp).toBeVisible()
			// await expect(this.continueButtonPopUp).toBeVisible()
		})
	}
	async loginExistingUser(page, falsePassword, userName, password) {
		await test.step('Enter user email', async () => {
			// enter email in field and click Continue button
			await this.emailFieldPopUp.click({ force: true })
			await this.emailFieldPopUp.fill(userName)
			await this.continueButtonPopUp.click()
		})
		await test.step('Enter false password & verify error', async () => {
			// enter in Password
			await this.passwordFieldPopUp.waitFor({ state: 'visible' })
			await expect(this.passwordFieldPopUp).toBeVisible()
			await expect(this.signInButton).toBeVisible()
			//enter false password to verify enforcement
			await this.passwordFieldPopUp.click()
			await this.passwordFieldPopUp.fill(falsePassword)
			// click sign in button
			await this.signInButton.click()
			await expect(this.signInError).toHaveText('Sign in unsuccessful')
			await page.waitForTimeout(1500)
		})
		await test.step('Enter user password', async () => {
			// enter in Password
			await this.passwordFieldPopUp.waitFor({ state: 'visible' })
			await expect(this.passwordFieldPopUp).toBeVisible()
			await this.passwordFieldPopUp.click()
			await this.passwordFieldPopUp.fill(password)
		})
		await test.step('Click Sign', async () => {
			// click sign in button
			await expect(this.signInButton).toBeVisible()
			await this.signInButton.click()
		})
	}
	async registerNewUser(page, userType) {
		const now = new Date()
		// Construct the timestamp string with date and time
		const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
			now.getDate(),
		).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(
			now.getMinutes(),
		).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(
			now.getMilliseconds(),
		).padStart(3, '0')}`

		// enter a unique test email for test user
		const newEmail = `test_auto_${userType}_${timestamp}@test.com`
		console.log(`\n New user email ---> ${newEmail} \n`)
		await test.step('Enter new user email and continue to register user screen', async () => {
			// enter email in field and click Continue button
			await this.emailFieldPopUp.click()
			await this.emailFieldPopUp.fill(newEmail)
			await this.continueButtonPopUp.click()
		})
		await test.step('Enter new user password', async () => {
			// enter in generic password for test user
			await this.passwordFieldPopUp.waitFor({ state: 'visible' })
			await expect(this.passwordFieldPopUp).toBeVisible()
			await this.passwordFieldPopUp.click()
			await this.passwordFieldPopUp.fill(this.alwaysOnPassword)
		})
		await test.step('Enter new user First Name, Last Name, and Zip Code', async () => {
			// enter in First Name
			await expect(this.firstNameField).toBeVisible()
			await this.firstNameField.click()
			await this.firstNameField.fill(`Test User ${timestamp}`)
			// enter in Last Name
			await expect(this.lastNameField).toBeVisible()
			await this.lastNameField.click()
			await this.lastNameField.fill(`Test User ${timestamp}`)
			// enter in Zip Code only if visible; otherwise continue forward
			if (await this.zipCodeField.isVisible()) {
				await this.zipCodeField.click()
				await this.zipCodeField.fill(`90232`)
			}
		})
		await test.step('Click create account to create new user', async () => {
			// click create account
			await expect(this.createAccountButton).toBeVisible()
			await this.createAccountButton.click()
			// verify that modal disspears
			//await this.userPopUpContainer.waitFor({ state: 'hidden' })
		})
	}

	async conciergeVerifyShopLoadsAfterSignIn(page) {
		await test.step('Verify User Modal disspears and that shop page loads', async () => {
			await this.userPopUpContainer.waitFor({ state: 'hidden' })

			// // verify page title, logo, account and cart button are visible
			await this.pageTitleSelector.waitFor({ state: 'visible' })
			await expect(this.pageTitleSelector).toBeVisible()
			await expect(this.accountButtonNav).toBeVisible()
			await expect(this.cartButtonNav).toBeVisible()
		})
	}
	async liveVerifyShopLoadsAfterSignIn(page) {
		await test.step('Verify User Modal disspears and that shop page loads', async () => {
			//await this.userPopUpContainer.waitFor({ state: 'hidden' })

			// // verify page title, logo, account and cart button are visible
			await this.pageTitleSelector.waitFor({ state: 'visible' })
			await expect(this.pageTitleSelector).toBeVisible()
			await expect(this.accountButtonNav).toBeVisible()
			await expect(this.cartButtonNav).toBeVisible()
			// Verify that Shop by Store displays
			await expect(this.shopByStoreTitle).toBeVisible()
			await expect(this.firstStoreCard).toBeVisible()
			await expect(this.shopByCategoryTitle).toBeVisible()
			await expect(this.concentratesCard).toBeVisible()
			await expect(this.flowerCard).toBeVisible()
		})
	}
}
module.exports = { HomePageLogin }
