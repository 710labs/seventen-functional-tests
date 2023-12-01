import test, { expect, Page } from '@playwright/test'

export class AgeGatePage {
	page: Page
	/**
	 * @param {import('playwright').Page} page
	 */
	constructor(page) {
		this.page = page
	}

	async passAgeGate() {
		await test.step('Pass Age Gate', async () => {
			await this.page.goto('/')
			if (this.page.url().includes('thelist.theflowery.co')) {
				await expect(this.page.locator('.age-gate-challenge')).toHaveText(
					'You must be at least 18 years old with a valid Florida medical recommendation to view this site.',
				)
			} else if (this.page.url().includes('thelist-mi')) {
				await expect(this.page.locator('.age-gate-challenge')).toHaveText(
					'You must be at least 21 years old or possess a valid medical recommendation to view this site',
				)
			} else if (this.page.url().includes('thelist-co')) {
				await expect(this.page.locator('.age-gate-challenge')).toHaveText(
					'You must be at least 21 years old or possess a valid medical recommendation to view this site.',
				)
			} else {
				await expect(this.page.locator('.age-gate-challenge')).toHaveText(
					'You must be at least 21 years of age or possess a valid medical recommendation to view this site.',
				)
			}

			if (
				this.page.url().includes('thelist.theflowery.co') ||
				this.page.url().includes('thelist-co.710labs.com')
			) {
				await this.page.click('text=I Qualify')
			} else {
				await this.page.click("text=I'm over 21 or a qualified patient")
			}
			const passwordField = await this.page.locator('input[name="post_password"]')
			await expect(
				passwordField,
				'Could not find the The List password field. The list password page may be in the incorrect order workflow',
			).toBeVisible()
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
