import { expect, test } from '@playwright/test'
import { AgeGatePage } from '../../models/age-gate-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'

test('Enter List Password - Valid @CA @FL', async ({ page }) => {
	const ageGatePage = new AgeGatePage(page)
	const listPasswordPage = new ListPasswordPage(page)

	await ageGatePage.passAgeGate()
	await listPasswordPage.submitPassword('qatester')

	await expect(page).toHaveURL('/my-account/')
})

test('Enter List Password - Invalid @CA @FL', async ({ page }) => {
	const ageGatePage = new AgeGatePage(page)
	const listPasswordPage = new ListPasswordPage(page)

	await ageGatePage.passAgeGate()
	await listPasswordPage.submitPassword('INCORRECT')
	await expect(await page.title(), "List password was not enforced").toContain('Password – 710 Labs')
})
