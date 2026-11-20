import { expect, Page, test } from '@playwright/test'
import { randomInt } from 'node:crypto'
const { STAGE_URL } = require('./targets.cjs')

export async function configureMedicalProfile(page: Page, issuingState: 'CA' | 'MI') {
	await test.step('Save and verify the new customer medical card', async () => {
		await page.goto(`${STAGE_URL}/my-account/`)
		await expect(page.getByRole('link', { name: 'Sign out', exact: true })).toBeVisible()
		await page.locator('a.specific-link[data-module="meddoc"]').first().click()
		const drawer = page.locator('.wpse-drawer').filter({
			has: page.getByRole('heading', { name: 'Replace your med card on file', exact: true }),
		})
		await expect(drawer).toBeInViewport()
		await drawer.locator('#fasd_medcard').setInputFiles('Medical-Card.png')
		await drawer.locator('#medcard_state').selectOption(issuingState)
		const year = new Date().getFullYear() + 1
		await drawer.locator('#medcard_exp').fill(`${year}-04-10`)
		const cardNumber = String(randomInt(10000000, 100000000))
		await drawer.locator('#medcard_no').fill(cardNumber)
		await drawer.locator('a.wpse-button-primary.fasd-form-submit').click()
		await expect(drawer).not.toBeInViewport()
		// The replacement form intentionally clears its inputs when reopened.
		// Verify the persisted document summary after reload instead.
		await page.reload()
		const summary = page.locator('#render_medcard_summary')
		await expect(summary).toContainText(`04/10/${year}`)
		await expect(summary.locator('img')).toHaveAttribute('src', /\S+/)
	})
}
