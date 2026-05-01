import test, { expect, Locator, Page } from '@playwright/test'

type LoginOptions = {
	requireFulfillmentRoute?: boolean
}

export class LoginPage {
	readonly page: Page
	readonly userNameField: Locator
	readonly passwordField: Locator
	readonly lostPasswordLink: Locator
	readonly rememberMeCheckBox: Locator
	readonly loginButton: Locator
	readonly createAccountLink: Locator

	constructor(page: Page) {
		this.page = page
		this.userNameField = page.locator('#username')
		this.passwordField = page.locator('#password')
		this.lostPasswordLink = page.locator('.lost_password')
		this.rememberMeCheckBox = page.locator('#rememberme')
		this.loginButton = page.locator('[name="login"]')
	}

	async login(username: string, password: string, options: LoginOptions = {}) {
		await test.step('Enter Username', async () => {
			await this.userNameField.click()
			await this.userNameField.fill(username)
		})

		await test.step('Enter Password', async () => {
			await this.passwordField.click()

			await this.passwordField.fill(password)
		})

		await test.step('Click Login Button', async () => {
			await this.loginButton.click()
			const expectedRoute = options.requireFulfillmentRoute
				? /^\/#(?:pickup-deliver|pickup|deliver)$/
				: /^\/(?:#(?:pickup-deliver|pickup|deliver))?$/

			await expect
				.poll(() => {
					const url = new URL(this.page.url())
					return `${url.pathname}${url.hash}`
				})
				.toMatch(expectedRoute)
		})
	}
}
