require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class OrderConfirmationPage {
	readonly page: Page
	readonly orderConfirmationTitle: Locator
	constructor(page: Page) {
		this.page = page
		this.orderConfirmationTitle = page.locator(
			`//h2[@style='font-size:30px;margin-bottom:24px;' and text()='Your order is confirmed']`,
		)
	}
	async verifyOrderConfirmationPageLoads(page) {
		await test.step('Verify the Checkout titleloads correctly', async () => {
			await page.waitForTimeout(5000)
			// verify that checkout page title loads
			await this.orderConfirmationTitle.waitFor({ timeout: 30000, state: 'visible' })
			await expect(this.orderConfirmationTitle).toBeVisible()
		})
	}
}
module.exports = { OrderConfirmationPage }
