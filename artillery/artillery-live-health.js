async function smoke(page, vuContext, events, test) {
	const target = vuContext.vars.target || process.env.ARTILLERY_TARGET

	if (!target) {
		throw new Error('ARTILLERY_TARGET is required for the live health scenario.')
	}

	const { step } = test

	await step('Load homepage', async () => {
		await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 })
	})

	await step('Dismiss age gate when present', async () => {
		const acceptButton = page.getByRole('button', {
			name: /i'?m over 21|qualified patient/i,
		})

		try {
			await acceptButton.click({ timeout: 10000 })
		} catch (error) {
			console.log('Age gate button not present, continuing with smoke flow.')
		}
	})

	await step('Confirm page remains responsive', async () => {
		await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
		await page.locator('body').waitFor({ state: 'visible', timeout: 30000 })
	})
}

module.exports = { smoke }
