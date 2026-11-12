// Report static error codes so Google console messages and API keys stay out of test logs.
async function selectAutocompleteAddress(page, field, address, timeout, expect) {
	let mapsFailure = ''
	const onConsole = (message) => {
		if (message.text().includes('RefererNotAllowedMapError')) mapsFailure = 'ADDRESS_REFERRER_DENIED'
		else if (/ApiNotActivatedMapError|InvalidKeyMapError|BillingNotEnabledMapError|Places\.AutocompletePlaces are blocked/.test(message.text())) {
			mapsFailure = 'ADDRESS_API_CONFIGURATION'
		}
	}
	const onResponse = (response) => {
		if (!mapsFailure && response.status() === 403 &&
			response.url().startsWith('https://places.googleapis.com/$rpc/google.maps.places.v1.Places/AutocompletePlaces')) {
			mapsFailure = 'ADDRESS_API_CONFIGURATION'
		}
	}
	page.on('console', onConsole)
	page.on('response', onResponse)
	let modern = false
	try {
		await field.waitFor({ state: 'visible', timeout })
		modern = await field.evaluate(element => element.tagName === 'GMP-PLACE-AUTOCOMPLETE')
		if (!modern) {
			await field.fill(address, { timeout })
			const suggestion = page.locator('.pac-item:visible').first()
			await expect.poll(async () => mapsFailure || (await suggestion.isVisible() ? 'ready' : ''), { timeout })
				.not.toBe('')
			if (mapsFailure) throw new Error(mapsFailure)
			await suggestion.click({ timeout })
			return
		}

		// A bare custom-element tag can exist before the Google library loads.
		await expect.poll(() => field.evaluate(element => element.matches(':defined')), { timeout })
			.toBe(true)
		await field.evaluate(element => {
			const host = element
			const form = host.closest('form')
			host.addressProbeCleanup?.()
			host.dataset.qaAddressSelection = 'pending'
			const selected = () => { host.dataset.qaAddressSelection = 'selected' }
			const failed = () => { host.dataset.qaAddressSelection = 'error' }
			// Enter can submit the surrounding form if no prediction is highlighted.
			const preventSubmit = (event) => event.preventDefault()
			host.addEventListener('gmp-select', selected)
			host.addEventListener('gmp-error', failed)
			form?.addEventListener('submit', preventSubmit)
			host.addressProbeCleanup = () => {
				host.removeEventListener('gmp-select', selected)
				host.removeEventListener('gmp-error', failed)
				form?.removeEventListener('submit', preventSubmit)
				delete host.dataset.qaAddressSelection
				delete host.addressProbeCleanup
			}
		})

		const input = field.locator('input').first()
		if (await input.isVisible()) {
			// Playwright locators pierce open shadow roots.
			await input.fill(address, { timeout })
			const prediction = field.locator('[role="option"]:visible, [part~="prediction-item"]:visible').first()
			await expect.poll(async () => mapsFailure || (await prediction.isVisible() ? 'ready' : ''), { timeout })
				.not.toBe('')
			if (mapsFailure) throw new Error(mapsFailure)
			await prediction.click({ timeout })
		} else {
			// Closed shadow roots expose keyboard interaction through the host.
			// Do not assign .value or fabricate a selection event: the application
			// needs an actual Google place selection to resolve the address.
			await field.click({ timeout })
			await page.keyboard.press('ControlOrMeta+A')
			await page.keyboard.type(address, { delay: 25 })
			// The closed prediction list cannot be queried; allow its debounce,
			// then require the public gmp-select event below before proceeding.
			await page.waitForTimeout(1000)
			if (mapsFailure) throw new Error(mapsFailure)
			await page.keyboard.press('ArrowDown')
			await page.keyboard.press('Enter')
		}
		await expect.poll(async () => mapsFailure || await field.getAttribute('data-qa-address-selection'), { timeout })
			.not.toBe('pending')
		if (mapsFailure) throw new Error(mapsFailure)
		if (await field.getAttribute('data-qa-address-selection') !== 'selected') {
			throw new Error('ADDRESS_SELECTION_FAILED')
		}
	} catch (error) {
		if (mapsFailure) throw new Error(mapsFailure)
		if (modern && !(await field.evaluate(element => element.matches(':defined')).catch(() => false))) {
			throw new Error('ADDRESS_WIDGET_UNAVAILABLE')
		}
		if (error instanceof Error && error.message === 'ADDRESS_SELECTION_FAILED') throw error
		throw new Error('ADDRESS_AUTOCOMPLETE_FAILED')
	} finally {
		page.off('console', onConsole)
		page.off('response', onResponse)
		if (modern) await field.evaluate(element => {
			element.addressProbeCleanup?.()
		}).catch(() => {})
	}
}

module.exports = { selectAutocompleteAddress }
