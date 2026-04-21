import test, { expect, Locator, Page } from '@playwright/test'

export class OrderExportProfilePage {
	readonly page: Page
	readonly fromDateInput: Locator
	readonly toDateInput: Locator
	readonly saveSettingsButton: Locator
	readonly exportButton: Locator

	constructor(page: Page) {
		this.page = page
		this.fromDateInput = page.locator('#from_date')
		this.toDateInput = page.locator('#to_date')
		this.saveSettingsButton = page.locator('#save-only-btn')
		this.exportButton = page.locator('#export-btn')
	}

	async goto() {
		await test.step('Open order export profile', async () => {
			await this.page.goto(
				'/wp-admin/admin.php?page=wc-order-export&tab=profiles&wc_oe=edit_profile&profile_id=6#segment=common',
			)
			await expect(this.page).toHaveURL(/profile_id=6/)
			await expect(this.fromDateInput).toBeVisible()
			await expect(this.toDateInput).toBeVisible()
		})
	}

	async setDateRange(fromDate: string, toDate: string) {
		await test.step(`Set export date range ${fromDate} to ${toDate}`, async () => {
			await this.fromDateInput.fill(fromDate)
			await this.toDateInput.fill(toDate)
		})
	}

	async saveSettings() {
		await test.step('Save export profile settings', async () => {
			await expect(this.saveSettingsButton).toBeVisible()
			await this.saveSettingsButton.click()
			await this.page.waitForLoadState('networkidle')
			await expect(this.page).toHaveURL(/profile_id=6/)
			await expect(this.exportButton).toBeVisible()
		})
	}

	async clickExport() {
		await test.step('Start order export', async () => {
			await expect(this.exportButton).toBeVisible()
			await this.exportButton.click()
		})
	}
}
