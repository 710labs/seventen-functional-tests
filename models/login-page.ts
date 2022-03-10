import test, { expect, Locator, Page } from '@playwright/test'

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

	async login(username: string, password: string) {
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
			await expect(this.page).toHaveURL('/')
		})
	}
}
