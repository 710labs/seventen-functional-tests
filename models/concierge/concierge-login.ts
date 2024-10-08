require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class ConciergeLogin {
	readonly conciergeUser: string
	readonly conciergePassword: string
	readonly page: Page
	readonly pageTitleSelector: Locator
	readonly emailField: Locator
	readonly passwordField: Locator
	readonly signInButton: Locator

	constructor(page: Page) {
		this.conciergeUser = process.env.CONCIERGE_USER || ''
		this.conciergePassword = process.env.CONCIERGE_PASSWORD || ''
		this.page = page
		this.pageTitleSelector = page.locator('h2:has-text("Sign in to Concierge")')
		this.emailField = page.locator('#username')
		this.passwordField = page.locator('#password')
		this.signInButton = page.locator('button[name="login"]')
	}
	async loginExistingUser(page) {
		await test.step('Verify the Homepage loads correctly', async () => {
			const conciergeURL = process.env.CONCIERGE_URL || ''

			//go to page
			await page.goto(conciergeURL)

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
			await this.emailField.fill(this.conciergeUser)
			await this.passwordField.click()
			await this.passwordField.fill(this.conciergePassword)
			await this.signInButton.click()
		})
	}
	async loginNewUserCreated(page, newUsername, newPassword) {
		await test.step('Verify the Homepage loads correctly', async () => {
			const conciergeURL = process.env.CONCIERGE_URL || ''

			//go to page
			await page.goto(conciergeURL)

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
			await this.emailField.fill(newUsername)
			await this.passwordField.click()
			await this.passwordField.fill(newPassword)
			await this.signInButton.click()
		})
	}
}
module.exports = { ConciergeLogin }
