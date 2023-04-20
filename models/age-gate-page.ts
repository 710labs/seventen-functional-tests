import test, { expect, Page } from '@playwright/test'
import { visualDiff } from '../utils/visual-diff'

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
			if (this.page.url().includes('thelist.theflowery.co')) {
				await expect(this.page.locator('.age-gate-challenge')).toHaveText(
					'You must be at least 18 years old with a valid Florida medical recommendation to view this site.',
				)
				await visualDiff(this.page, `age-gate-FL-${process.env.ENV}.png`, 500)
			} else {
				const expectedText1 = 'You must be at least 21 years of age or possess a valid medical recommendation to view this site.';
				const expectedText2 = 'You must be at least 21 years old or possess a valid medical recommendation to view this site.';
				const actualText = await this.page.locator('.age-gate-challenge').textContent();

				expect(actualText === expectedText1 || actualText === expectedText2).toBeTruthy();
				// await expect(this.page.locator('.age-gate-challenge')).toHaveText(
				// 	'You must be at least 21 years of age or possess a valid medical recommendation to view this site.',
				// )
				await visualDiff(this.page, `age-gate-CA-MI-${process.env.ENV}.png`, 500)
			}

			if (this.page.url().includes('thelist.theflowery.co')) {
				await this.page.click('text=I Qualify')
			} else {
				const buttonText1 = "I'm over 21 or a qualified patient";
				const buttonText2 = "I Qualify";
				try {
					await this.page.click(`text=${buttonText1}`, { timeout: 1000 });
				} catch (e) {
					try {
						await this.page.click(`text=${buttonText2}`, { timeout: 1000 });
					} catch (e) {
						console.error('Neither of the buttons with the specified texts was found.');
					}
				}
				//await this.page.click("text=I'm over 21 or a qualified patient")
			}
			const passwordField = await this.page.locator('input[name="post_password"]')
			await expect(passwordField, 'Could not find the The List password field. The list password page may be in the incorrect order workflow').toBeVisible();
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
			// visual diff fail age screen
			await visualDiff(this.page, `fail-age-gate-message-${process.env.ENV}.png`, 500)
		})
	}
}
module.exports = { AgeGatePage }
