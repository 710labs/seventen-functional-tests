require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class AccountPage {
	readonly page: Page
	readonly pageTitleSelector: Locator
	readonly accountButtonNav: Locator
	readonly signOutButton: Locator

	constructor(page: Page) {
		this.page = page
		this.pageTitleSelector = page.locator('span.site-header-group')
		this.accountButtonNav = page.locator('svg.icon.icon-account')
		this.signOutButton = page.locator('a:has-text("Sign out")')
	}
	async logOut(page) {
		await test.step('Log out User', async () => {
			// verify page title, logo, account and cart button are visible
			await this.accountButtonNav.waitFor({ state: 'visible' })
			await expect(this.accountButtonNav).toBeVisible()
			// click account button in nav bar
			await this.accountButtonNav.click()
			// verify that sign out button appears
			await this.signOutButton.waitFor({ state: 'visible' })
			await expect(this.signOutButton).toBeVisible()
			await this.signOutButton.click()
		})
	}
}
module.exports = { AccountPage }
