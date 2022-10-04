import test, { expect, Locator, Page } from '@playwright/test'

export class AdminLogin {
	readonly page: Page
	readonly userNameField: Locator
	readonly passwordField: Locator
	readonly loginButton: Locator

	constructor(page: Page) {
		this.page = page
		this.userNameField = page.locator('input[name="log"]')
		this.passwordField = page.locator('input[name="pwd"]')
		this.loginButton = page.locator('text=Log In')
	}

	async login() {
		await test.step('Login User', async () => {
			await Promise.all([
				await this.page.goto('/wp-admin/'),
				await this.userNameField.fill(`${process.env.ADMIN_USER}`),
				await this.passwordField.fill(`${process.env.ADMIN_PW}`),
				await this.loginButton.click(),
			])
		})
	}
}
