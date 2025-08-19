require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class OrderConfirmationPage {
	readonly page: Page
	readonly orderConfirmationTitle: Locator
	readonly orderNumberElement: Locator
	readonly orderNumber: Locator
	constructor(page: Page) {
		this.page = page
		this.orderConfirmationTitle = page.locator(
			`//h2[@style='font-size:30px;margin-bottom:24px;' and text()='Your order is confirmed']`,
		)
		// Full element that contains the label and link
		this.orderNumberElement = page.locator('p.thankyou-number')
		// Element that contains only the order number digits
		this.orderNumber = page.locator('p.thankyou-number a')
	}

	async getOrderNumber() {
		//await this.orderNumberElement.waitFor({ timeout: 5000 })
		const textContent = await this.orderNumberElement.textContent()
		const rawText = (textContent ?? '').trim()
		const match = rawText.match(/\d+/)
		return match ? match[0] : rawText
	}
	async verifyOrderConfirmationPageLoads(page) {
		await test.step('Verify the Checkout titleloads correctly', async () => {
			//await page.waitForTimeout(10000)
			await page.waitForLoadState('networkidle') // Wait for all network requests to finish
			// verify that checkout page title loads
			await this.orderConfirmationTitle.waitFor({ timeout: 30000 })
			await expect(this.orderConfirmationTitle).toBeVisible()
		})
	}
}
module.exports = { OrderConfirmationPage }
