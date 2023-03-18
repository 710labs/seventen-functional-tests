import test, { Page, expect } from '@playwright/test'

export class ListPasswordPage {
	page: Page
	/**
	 * @param {import('playwright').Page} page
	 */
	constructor(page) {
		this.page = page
	}

	async submitPassword(password: string) {
		await test.step('Enter List Password', async () => {
			const passwordField = await this.page.locator('input[name="post_password"]')

			// visual diff of site password screen
			await expect(this.page).toHaveScreenshot('site-password-screen.png', { maxDiffPixels: 100 });

			await expect(
				passwordField,
				'Could not find the The List password field. The list password page may be in the incorrect order workflow',
			).toBeVisible()
			await passwordField.click()
			await passwordField.fill(password)
		})
		await test.step('Submit List Password', async () => {
			await this.page.press('input[name="post_password"]', 'Enter')
		})
	}
}
module.exports = { ListPasswordPage }
