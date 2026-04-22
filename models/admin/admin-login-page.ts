import test, { expect, Locator, Page } from '@playwright/test'

export class AdminLogin {
	readonly page: Page
	readonly userNameField: Locator
	readonly passwordField: Locator
	readonly loginButton: Locator
	readonly accountMenu: Locator
	readonly accountMenuLink: Locator
	readonly logoutButton: Locator

	constructor(page: Page) {
		this.page = page
		this.userNameField = page.locator('input[name="log"]')
		this.passwordField = page.locator('input[name="pwd"]')
		this.loginButton = page.locator('input[name="wp-submit"]')
		this.accountMenu = page.locator('#wp-admin-bar-my-account')
		this.accountMenuLink = page.locator('#wp-admin-bar-my-account > a.ab-item')
		this.logoutButton = page.locator('#wp-admin-bar-logout a.ab-item')
	}

	async login() {
		await test.step('Login Admin User', async () => {
			await this.page.goto('/wp-admin/')
			await expect(this.userNameField).toBeVisible()
			await expect(this.passwordField).toBeVisible()
			await this.userNameField.fill(`${process.env.ADMIN_USER}`)
			await this.passwordField.fill(`${process.env.ADMIN_PW}`)
			await Promise.all([
				this.page.waitForNavigation({ waitUntil: 'networkidle' }),
				this.loginButton.click(),
			])
			await expect(this.accountMenu).toBeVisible()
		})
	}

	async logout() {
		await test.step('Logout Admin User', async () => {
			await expect(this.accountMenu).toBeVisible()
			await this.accountMenuLink.hover()
			await expect(this.logoutButton).toBeVisible()
			await Promise.all([
				this.page.waitForNavigation({ waitUntil: 'networkidle' }),
				this.logoutButton.click(),
			])
			await expect(this.userNameField).toBeVisible()
		})
	}

	async ensureLoggedIn() {
		await test.step('Ensure Admin User Is Logged In', async () => {
			const isLoggedIn = await this.accountMenu.isVisible().catch(() => false)

			if (isLoggedIn) {
				return
			}

			await this.login()
		})
	}
}
