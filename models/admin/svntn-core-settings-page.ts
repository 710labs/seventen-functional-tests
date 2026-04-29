import test, { expect, Locator, Page } from '@playwright/test'

export type PurchaseLimits = {
	pickupMinimum: string
	deliveryMinimum: string
	pickupMaximum: string
	deliveryMaximum: string
	checkoutsMaximum: string
}

export class SvntnCoreSettingsPage {
	readonly page: Page
	readonly pickupMinimumInput: Locator
	readonly deliveryMinimumInput: Locator
	readonly pickupMaximumInput: Locator
	readonly deliveryMaximumInput: Locator
	readonly checkoutsMaximumInput: Locator
	readonly submitButton: Locator
	readonly successNotice: Locator

	constructor(page: Page) {
		this.page = page
		this.pickupMinimumInput = page.locator('#svntn_pickup_minimum')
		this.deliveryMinimumInput = page.locator('#svntn_delivery_minimum')
		this.pickupMaximumInput = page.locator('#svntn_pickup_maximum')
		this.deliveryMaximumInput = page.locator('#svntn_delivery_maximum')
		this.checkoutsMaximumInput = page.locator('#svntn_checkouts_maximum')
		this.submitButton = page.locator('#submit')
		this.successNotice = page
			.locator('#setting-error-settings_updated, .notice.notice-success, .updated')
			.filter({ hasText: /settings saved|updated/i })
	}

	async goto() {
		await test.step('Open 710 Labs Core settings', async () => {
			await this.page.goto('/wp-admin/admin.php?page=svntn-core-settings')
			await expect(this.page).toHaveURL(/page=svntn-core-settings/)
			await expect(this.pickupMinimumInput).toBeVisible()
			await expect(this.deliveryMinimumInput).toBeVisible()
			await expect(this.submitButton).toBeVisible()
		})
	}

	async getPurchaseLimits(): Promise<PurchaseLimits> {
		return test.step('Read purchase limit settings', async () => {
			return {
				pickupMinimum: await this.pickupMinimumInput.inputValue(),
				deliveryMinimum: await this.deliveryMinimumInput.inputValue(),
				pickupMaximum: await this.pickupMaximumInput.inputValue(),
				deliveryMaximum: await this.deliveryMaximumInput.inputValue(),
				checkoutsMaximum: await this.checkoutsMaximumInput.inputValue(),
			}
		})
	}

	async setPurchaseLimits(limits: Partial<PurchaseLimits>) {
		await test.step('Set purchase limit fields', async () => {
			if (limits.pickupMinimum !== undefined) {
				await this.pickupMinimumInput.fill(limits.pickupMinimum)
			}

			if (limits.deliveryMinimum !== undefined) {
				await this.deliveryMinimumInput.fill(limits.deliveryMinimum)
			}

			if (limits.pickupMaximum !== undefined) {
				await this.pickupMaximumInput.fill(limits.pickupMaximum)
			}

			if (limits.deliveryMaximum !== undefined) {
				await this.deliveryMaximumInput.fill(limits.deliveryMaximum)
			}

			if (limits.checkoutsMaximum !== undefined) {
				await this.checkoutsMaximumInput.fill(limits.checkoutsMaximum)
			}
		})
	}

	async saveChanges() {
		await test.step('Save 710 Labs Core settings', async () => {
			await this.submitButton.click()
			await this.page.waitForLoadState('networkidle').catch(() => {})
			await expect(this.successNotice.first()).toBeVisible()
		})
	}

	async setAndSavePurchaseLimits(limits: Partial<PurchaseLimits>) {
		await this.setPurchaseLimits(limits)
		await this.saveChanges()
	}
}
