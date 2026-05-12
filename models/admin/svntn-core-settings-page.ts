import test, { expect, Locator, Page } from '@playwright/test'

export type MinimumOrderSettings = {
	pickupMinimum: number
	deliveryMinimum: number
}

export class SvntnCoreSettingsPage {
	readonly page: Page
	readonly settingsForm: Locator
	readonly pickupMinimumInput: Locator
	readonly deliveryMinimumInput: Locator
	readonly submitButton: Locator

	constructor(page: Page) {
		this.page = page
		this.settingsForm = page.locator('#wpbody-content form[action="options.php"]')
		this.pickupMinimumInput = this.settingsForm.locator('#svntn_pickup_minimum')
		this.deliveryMinimumInput = this.settingsForm.locator('#svntn_delivery_minimum')
		this.submitButton = this.settingsForm.locator('#submit')
	}

	async goto() {
		await test.step('Open SVNTN Core settings', async () => {
			await this.page.goto('/wp-admin/admin.php?page=svntn-core-settings')
			await expect(this.page).toHaveURL(/page=svntn-core-settings/)
			await this.assertMinimumOrderFieldsReady()
		})
	}

	async getMinimumOrderSettings(): Promise<MinimumOrderSettings> {
		return await test.step('Read minimum-order settings', async () => {
			await this.assertMinimumOrderFieldsReady()

			return {
				pickupMinimum: await this.readNumberInput(this.pickupMinimumInput, 'pickup minimum'),
				deliveryMinimum: await this.readNumberInput(this.deliveryMinimumInput, 'delivery minimum'),
			}
		})
	}

	async setMinimumOrderSettings(settings: MinimumOrderSettings): Promise<void> {
		await test.step('Set minimum-order settings', async () => {
			await this.assertMinimumOrderFieldsReady()

			await this.fillNumberInput(this.pickupMinimumInput, settings.pickupMinimum, 'pickup minimum')
			await this.fillNumberInput(this.deliveryMinimumInput, settings.deliveryMinimum, 'delivery minimum')
		})
	}

	async save(): Promise<void> {
		await test.step('Save SVNTN Core settings', async () => {
			await expect(this.submitButton, 'SVNTN Core settings submit button is not visible').toBeVisible()
			await expect(this.submitButton, 'SVNTN Core settings submit button is not enabled').toBeEnabled()
			await this.submitButton.click()
			await this.page.waitForLoadState('domcontentloaded').catch(() => {})
			await this.page.waitForLoadState('networkidle').catch(() => {})
			await expect(this.page).toHaveURL(/page=svntn-core-settings/)
			await this.assertMinimumOrderFieldsReady()
		})
	}

	async setAndSaveMinimumOrderSettings(settings: MinimumOrderSettings): Promise<void> {
		await test.step('Set and save minimum-order settings', async () => {
			await this.setMinimumOrderSettings(settings)
			await this.save()
		})
	}

	async assertMinimumOrderSettings(expected: MinimumOrderSettings): Promise<MinimumOrderSettings> {
		return await test.step('Verify persisted minimum-order settings', async () => {
			await this.goto()

			const observed = await this.getMinimumOrderSettings()
			expect(
				observed.pickupMinimum,
				`Expected pickup minimum to persist as ${expected.pickupMinimum}, observed ${observed.pickupMinimum}`,
			).toBe(expected.pickupMinimum)
			expect(
				observed.deliveryMinimum,
				`Expected delivery minimum to persist as ${expected.deliveryMinimum}, observed ${observed.deliveryMinimum}`,
			).toBe(expected.deliveryMinimum)

			return observed
		})
	}

	private async assertMinimumOrderFieldsReady(): Promise<void> {
		await expect(this.settingsForm, 'SVNTN Core settings form is not visible').toBeVisible()
		await expect(this.pickupMinimumInput, 'Pickup minimum field is not visible').toBeVisible()
		await expect(this.pickupMinimumInput, 'Pickup minimum field is not editable').toBeEditable()
		await expect(this.deliveryMinimumInput, 'Delivery minimum field is not visible').toBeVisible()
		await expect(this.deliveryMinimumInput, 'Delivery minimum field is not editable').toBeEditable()
	}

	private async fillNumberInput(input: Locator, value: number, label: string): Promise<void> {
		const expectedValue = String(value)
		await input.click()
		await input.fill(expectedValue)
		await expect(input, `${label} field did not change to ${expectedValue} before submit`).toHaveValue(
			expectedValue,
		)
	}

	private async readNumberInput(input: Locator, label: string): Promise<number> {
		const rawValue = await input.inputValue()
		const parsedValue = Number(rawValue)

		if (!Number.isFinite(parsedValue)) {
			throw new Error(`Expected ${label} field to contain a number, received "${rawValue}"`)
		}

		return parsedValue
	}
}
