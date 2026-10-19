import { expect, test, type ConsoleMessage, type Locator, type Page } from '@playwright/test'

// These codes are intentionally static: public reporters must never include an
// address, Google response, API key, or browser console message.
export async function selectAutocompleteAddress(
	page: Page,
	field: Locator,
	address: string,
	timeout = 10000,
) {
	await test.step('Select address autocomplete suggestion', async () => {
		let mapsFailure = ''
		const onConsole = (message: ConsoleMessage) => {
			if (message.text().includes('RefererNotAllowedMapError')) mapsFailure = 'ADDRESS_REFERRER_DENIED'
			else if (/ApiNotActivatedMapError|InvalidKeyMapError|BillingNotEnabledMapError/.test(message.text())) {
				mapsFailure = 'ADDRESS_API_CONFIGURATION'
			}
		}
		page.on('console', onConsole)
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
				const host = element as HTMLElement & { addressProbeCleanup?: () => void }
				host.addressProbeCleanup?.()
				host.dataset.qaAddressSelection = 'pending'
				const selected = () => { host.dataset.qaAddressSelection = 'selected' }
				const failed = () => { host.dataset.qaAddressSelection = 'error' }
				host.addEventListener('gmp-select', selected)
				host.addEventListener('gmp-error', failed)
				host.addressProbeCleanup = () => {
					host.removeEventListener('gmp-select', selected)
					host.removeEventListener('gmp-error', failed)
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
			if (modern) await field.evaluate(element => {
				(element as HTMLElement & { addressProbeCleanup?: () => void }).addressProbeCleanup?.()
			}).catch(() => {})
		}
	})
}
