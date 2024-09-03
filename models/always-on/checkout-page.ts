require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class checkoutPage {
	readonly page: Page
	readonly checkoutPageTitle: Locator

	constructor(page: Page) {
		this.page = page
		this.checkoutPageTitle = page.locator('h2:has-text("Checkout")')
	}
	async verifyCheckoutPageLoads(page) {
		await test.step('Verify the Checkout loads correctly', async () => {
			// verify that checkout page title loads
			await this.checkoutPageTitle.waitFor({ state: 'visible' })
		})
	}
}
module.exports = { checkoutPage }
