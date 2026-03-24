async function waitForInitialPageState(page) {
	const checks = [
		{
			label: 'age gate CTA',
			locator: page.getByRole('button', {
				name: /I'm over 21 or a qualified patient|I Qualify/i,
			}),
		},
		{
			label: 'list password field',
			locator: page.locator('input[name="post_password"]'),
		},
		{
			label: 'store header',
			locator: page.locator('span.site-header-group'),
		},
		{
			label: 'product grid',
			locator: page.locator('ul.products'),
		},
	]

	for (const check of checks) {
		try {
			await check.locator.first().waitFor({ state: 'visible', timeout: 5000 })
			return check.label
		} catch (error) {
			continue
		}
	}

	throw new Error('Could not detect an initial The List page state after opening the selected URL.')
}

async function TheListUrlHit(page, vuContext, events, test) {
	const { step } = test
	const target = vuContext.vars.target || process.env.ARTILLERY_TARGET || 'https://thelist-dev.710labs.com'

	await step('Open selected The List URL', async () => {
		const response = await page.goto(target, { waitUntil: 'domcontentloaded' })

		if (!response) {
			throw new Error(`No HTTP response received when opening ${target}.`)
		}

		if (response.status() >= 400) {
			throw new Error(`Unexpected status ${response.status()} when opening ${target}.`)
		}
	})

	await step('Verify initial page state', async () => {
		const detectedState = await waitForInitialPageState(page)
		console.log(`[thelist-url-hit] detected initial state: ${detectedState}`)
	})
}

module.exports = {
	TheListUrlHit,
}
