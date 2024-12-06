require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class ConciergeCreateUser {
	readonly adminConciergeUser: string
	readonly adminConciergePassword: string
	readonly page: Page
	readonly pageTitleSelector: Locator
	readonly emailField: Locator
	readonly passwordField: Locator
	readonly signInButton: Locator
	readonly dashboardTitle: Locator
	readonly usersTabDesktop: Locator
	readonly usersTabMobile: Locator
	readonly mobileAllUsersTab: Locator
	readonly userPageTitle: Locator
	readonly mobileMenuButton: Locator
	readonly addNewUserButton: Locator
	readonly newUserUsernameField: Locator
	readonly newUserPageTitle: Locator
	readonly newUserEmailField: Locator
	readonly firstNameField: Locator
	readonly lastNameField: Locator
	readonly newUserPasswordField: Locator
	readonly weakPasswordConfirmation: Locator
	readonly submitNewUserButton: Locator
	readonly searchBarUser: Locator
	readonly searchButton: Locator
	readonly usersTableBodyDesktop: Locator
	readonly usersTableBodyMobile: Locator
	readonly navBarSignOut: Locator
	readonly signOutButton: Locator
	readonly loggedOutText: Locator

	constructor(page: Page) {
		this.adminConciergeUser = process.env.ADMIN_CONCIERGE_USER || ''
		this.adminConciergePassword = process.env.ADMIN_CONCIERGE_PASSWORD || ''
		this.page = page
		this.pageTitleSelector = page.locator('h1')
		this.emailField = page.locator('#user_login.input')
		this.passwordField = page.locator('#user_pass')
		this.signInButton = page.locator('#wp-submit')
		this.dashboardTitle = page.locator('h1:has-text("Dashboard")')
		this.usersTabDesktop = page.locator('.wp-menu-name:has-text("Users")')
		this.usersTabMobile = page.locator('#wp-admin-bar-menu-toggle')
		this.mobileAllUsersTab = page.locator('a:has-text("All Users")')
		this.mobileMenuButton = page.locator('span.screen-reader-text:has-text("Menu")')
		this.userPageTitle = page.locator('.wp-heading-inline:has-text("Users")')
		this.addNewUserButton = page.locator('.page-title-action:has-text("Add New User")')
		this.newUserPageTitle = page.locator('#add-new-user')
		this.newUserUsernameField = page.locator('#user_login')
		this.newUserEmailField = page.locator('#email')
		this.firstNameField = page.locator('#first_name')
		this.lastNameField = page.locator('#last_name')
		this.newUserPasswordField = page.locator('#pass1.regular-text.strong')
		this.weakPasswordConfirmation = page.locator('input[type="checkbox"].pw-checkbox')
		this.submitNewUserButton = page.locator('input[type="submit"].button.button-primary')
		this.searchBarUser = page.locator('#user-search-input')
		this.searchButton = page.locator('#search-submit.button')
		this.usersTableBodyDesktop = page.locator('tbody#the-list')
		this.usersTableBodyMobile = page.locator('')
		this.navBarSignOut = page.locator('#wp-admin-bar-my-account')
		this.signOutButton = page.locator('a:has-text("Log Out")')
		this.loggedOutText = page.locator('p:has-text("You are now logged out.")')
	}
	async loginAdmin(page) {
		await test.step('Verify the WP Admin pages loads correctly', async () => {
			const conciergeAdminURL = process.env.CONCIERGE_ADMIN_URL || ''

			//go to page
			await page.goto(conciergeAdminURL)

			// verify that email login/signup popup appears and that correct text displays
			await this.pageTitleSelector.waitFor({ state: 'visible' })
			await expect(this.pageTitleSelector).toBeVisible()
			//verify that email field appears
			await expect(this.emailField).toBeVisible()
			await expect(this.passwordField).toBeVisible()
			await expect(this.signInButton).toBeVisible()
		})
		await test.step('Enter in user/password details to Login', async () => {
			await this.emailField.click()
			await this.emailField.fill(this.adminConciergeUser)
			await this.passwordField.click()
			await this.passwordField.fill(this.adminConciergePassword)
			await this.signInButton.click()
		})
		await test.step('Verify WP Dash loads', async () => {
			const conciergeAdminURL = process.env.CONCIERGE_ADMIN_URL || ''
			// Mobile view
			await expect(page).toHaveURL(conciergeAdminURL)
			await expect(this.dashboardTitle).toBeVisible()
		})
	}
	async createNewUser(page, newUserEmail, newUserPassword) {
		await test.step('Nav to Users page and Click Add New Users', async () => {
			const viewportSize = await page.viewportSize()
			if (viewportSize.width <= 768) {
				const conciergeAdminURL = process.env.CONCIERGE_ADMIN_URL || ''
				// Mobile view
				await page.goto(conciergeAdminURL + '/users.php')
				//
				await expect(this.userPageTitle).toBeVisible()
				//click add new user button
				await expect(this.addNewUserButton).toBeVisible()
				await this.addNewUserButton.click()
			} else {
				// Desktop view
				// verify admin dash loads
				await expect(this.dashboardTitle).toBeVisible()
				// click Users tab
				await expect(this.usersTabDesktop).toBeVisible()
				await this.usersTabDesktop.click()
				await expect(this.userPageTitle).toBeVisible()
				//click add new user button
				await expect(this.addNewUserButton).toBeVisible()
				await this.addNewUserButton.click()
			}
		})
		await test.step('Enter New User details', async () => {
			// verify new user page loads
			await expect(this.newUserPageTitle).toBeVisible()
			// enter username
			await expect(this.newUserUsernameField).toBeVisible()
			await this.newUserUsernameField.click()
			await this.newUserUsernameField.fill(newUserEmail)
			// enter Email
			await expect(this.newUserEmailField).toBeVisible()
			await this.newUserEmailField.click()
			await this.newUserEmailField.fill(newUserEmail)
			console.log('new user email: ' + newUserEmail)
			// enter First Name
			await expect(this.firstNameField).toBeVisible()
			await this.firstNameField.click()
			await this.firstNameField.fill('Automation Test User')
			// enter Last Name
			await expect(this.lastNameField).toBeVisible()
			await this.lastNameField.click()
			await this.lastNameField.fill('Automation Test User')
			// enter Password
			await this.newUserPasswordField.scrollIntoViewIfNeeded()
			await expect(this.newUserPasswordField).toBeVisible()
			await this.newUserPasswordField.click()
			await this.newUserPasswordField.fill(newUserPassword)
			await this.page.waitForTimeout(1500)
			//confirm weak password
			//await expect(this.weakPasswordConfirmation).toBeVisible()
			//await this.weakPasswordConfirmation.check()
			//await this.page.waitForTimeout(1500)
		})
		await test.step('Submit New User', async () => {
			await this.submitNewUserButton.scrollIntoViewIfNeeded()
			await expect(this.submitNewUserButton).toBeVisible()
			await this.submitNewUserButton.click()
			//verify that returns to users page
			await this.userPageTitle.waitFor({ state: 'visible', timeout: 15000 })
			await expect(this.userPageTitle).toBeVisible()
		})
		await test.step('Search & Verify that New User was Created', async () => {
			const viewportSize = await page.viewportSize()
			if (viewportSize.width <= 768) {
				await expect(this.searchBarUser).toBeVisible()
				await this.searchBarUser.click()
				await this.searchBarUser.fill(newUserEmail)
				//verify that returns to users page
				await this.searchButton.click()
				// Ensure the table body is visible and loaded
				await expect(this.usersTableBodyDesktop).toBeVisible()
				// Locate the email element in the table body
				const emailLocator = this.usersTableBodyDesktop.locator(`a[href^="mailto:"]`)
				// Extract the text content (the email address)
				const emailText = await emailLocator.textContent()
				// Log the extracted email for debugging purposes
				console.log(`Extracted email: ${emailText}`)
				// Verify that the extracted email matches the expected email
				expect(emailText.trim()).toBe(newUserEmail)
			} else {
				await expect(this.searchBarUser).toBeVisible()
				await this.searchBarUser.click()
				await this.searchBarUser.fill(newUserEmail)
				//verify that returns to users page
				await this.searchButton.click()
				// look for email in table
				const emailLocator = this.usersTableBodyDesktop
					.locator(`a[href*="${newUserEmail}"]`)
					.first()
				await emailLocator.scrollIntoViewIfNeeded()

				// Wait for the element to be visible explicitly
				await emailLocator.waitFor({ state: 'visible', timeout: 15000 })
				// Verify that the email is present in the table
				await expect(emailLocator).toBeVisible()
			}
		})
		await test.step('Sign Out as Admin', async () => {
			await expect(this.navBarSignOut).toBeVisible()
			await this.navBarSignOut.hover()
			await expect(this.signOutButton).toBeVisible()
			await this.signOutButton.click()
			await expect(this.loggedOutText).toBeVisible()
		})
	}
}
module.exports = { ConciergeCreateUser }
