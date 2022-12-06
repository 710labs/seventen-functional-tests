import test, { expect, Page } from '@playwright/test'

export class AgeGatePage {
	page: Page
	/**
	 * @param {import('playwright').Page} page
	 */
	constructor(page) {
		this.page = page
	}

	async passAgeGate(state: string = 'CA') {
		await test.step('Pass Age Gate', async () => {
			await this.page.goto('/')
			await test.step('Verify Layout', async () => {
				await expect(this.page.locator('h1 > img')).toBeVisible()

				await expect(this.page.locator('.site-info > span > a')).toHaveAttribute(
					'href',
					'/terms-of-use',
				)
				await expect(this.page.locator('.site-info > a')).toHaveAttribute('href', '/privacy-policy')
			})
			if (state === 'FL' && this.page.url().includes('thelist.theflowery.co')) {
				await expect(this.page.locator('.age-gate-challenge')).toHaveText(
					'You must be at least 18 years old with a valid Florida medical recommendation to view this site.',
				)
			} else {
				await expect(this.page.locator('.age-gate-challenge')).toHaveText(
					'You must be at least 21 years of age or possess a valid medical recommendation to view this site.',
				)
			}

			if (state === 'FL' && process.env.BASE_URL === 'https://thelist.theflowery.co/') {
				await this.page.click('text=I Qualify')
			} else {
				await this.page.click("text=I'm over 21 or a qualified patient")
			}
			const passwordField = await this.page.locator('input[name="post_password"]')
			await passwordField.click()
		})
	}

	async failAgeGate() {
		await test.step('Fail Age Gate', async () => {
			await this.page.goto('/')
			await this.page.click("text=I'm not 21 yet or don't qualify")
			await expect(this.page.locator('.age-gate-error-message')).toHaveText(
				'You are not old enough to view this content',
			)
		})
	}
}
module.exports = { AgeGatePage }
