import test, { expect, Locator, Page } from '@playwright/test'

export class PrivateStoreSettingsPage {
	readonly page: Page
	readonly passwordInputs: Locator
	readonly saveButton: Locator

	constructor(page: Page) {
		this.page = page
		this.passwordInputs = page.locator('input[name="wcps_store_password[]"]')
		this.saveButton = page.locator('.woocommerce-save-button')
	}

	async goto() {
		await test.step('Open Private Store settings', async () => {
			await this.page.goto('/wp-admin/admin.php?page=wc-settings&tab=products&section=private-store')
			await expect(this.page).toHaveURL(/section=private-store/)
			await expect(this.passwordInputs.first()).toBeVisible()
		})
	}

	async getPasswordValues() {
		const count = await this.passwordInputs.count()
		const values: string[] = []

		for (let index = 0; index < count; index++) {
			values.push(await this.passwordInputs.nth(index).inputValue())
		}

		return values
	}

	async addPassword(password: string) {
		await test.step(`Add private-store password ${password}`, async () => {
			const initialCount = await this.passwordInputs.count()
			await this.page.locator('.multi-field-input').nth(initialCount - 1).locator('.multi-field-add').click()
			await expect(this.passwordInputs).toHaveCount(initialCount + 1)
			await this.passwordInputs.nth(initialCount).fill(password)
		})
	}

	async saveChanges() {
		await test.step('Save private-store settings', async () => {
			await expect(this.saveButton).toBeVisible()
			await this.saveButton.click()
			await this.page.waitForLoadState('networkidle')
			await expect(this.page).toHaveURL(/section=private-store/)
			await expect(this.saveButton).toBeVisible()
		})
	}

	async hasPassword(password: string) {
		const passwords = await this.getPasswordValues()
		return passwords.includes(password)
	}

	async removePassword(password: string) {
		return await test.step(`Remove private-store password ${password}`, async () => {
			const rows = this.page.locator('.multi-field-input')
			const rowCount = await rows.count()

			for (let index = 0; index < rowCount; index++) {
				const row = rows.nth(index)
				const input = row.locator('input[name="wcps_store_password[]"]')

				if ((await input.inputValue()) !== password) {
					continue
				}

				const removeButton = row.locator('.multi-field-remove')
				if (!(await removeButton.count())) {
					throw new Error(`Matched password "${password}" but the row has no remove button`)
				}

				await Promise.all([
					this.page.waitForEvent('dialog').then(async dialog => {
						expect(
							dialog.type(),
							'Unexpected dialog type shown when deleting private-store password',
						).toBe('confirm')
						expect(
							dialog.message(),
							'Unexpected confirm message shown when deleting private-store password',
						).toBe('Are you sure you want to delete this password?')

						await dialog.accept()
					}),
					removeButton.click(),
				])
				await expect(this.passwordInputs).toHaveCount(rowCount - 1)
				await expect
					.poll(async () => await this.hasPassword(password), {
						message: `Expected private-store password "${password}" to be removed`,
					})
					.toBe(false)
				await this.saveChanges()
				await expect
					.poll(async () => await this.hasPassword(password), {
						message: `Expected private-store password "${password}" to stay removed after saving changes`,
					})
					.toBe(false)
				return true
			}

			return false
		})
	}
}
