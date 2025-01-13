import { test } from '@playwright/test'
import { AgeGatePage } from '../../models/age-gate-page'

test('Accept Age Gate - Valid @CA @FL @NJ', async ({ page }) => {
	const ageGatePage = new AgeGatePage(page)
	await ageGatePage.passAgeGate()
})

test('Accept Age Gate - Invalid @CA @FL @NJ', async ({ page }) => {
	const ageGatePage = new AgeGatePage(page)
	await ageGatePage.failAgeGate()
})
