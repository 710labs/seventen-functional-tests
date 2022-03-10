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
			await this.page.click('input[name="post_password"]')
			await this.page.fill('input[name="post_password"]', password)
		})
		await test.step('Submit List Password', async () => {
			await this.page.press('input[name="post_password"]', 'Enter')
		})
	}
}
module.exports = { ListPasswordPage }
