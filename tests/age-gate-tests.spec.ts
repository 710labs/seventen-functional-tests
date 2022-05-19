import { test } from '@playwright/test'
import { AgeGatePage } from '../models/age-gate-page'

test('Accept Age Gate - Valid @FullRun', async ({ page }) => {
	const ageGatePage = new AgeGatePage(page)
	await ageGatePage.passAgeGate()
})

test('Accept Age Gate - Invalid @FullRun', async ({ page }) => {
	const ageGatePage = new AgeGatePage(page)
	await ageGatePage.failAgeGate()
})
