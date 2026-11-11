import { expect, test, type Page } from '@playwright/test'
import { selectAutocompleteAddress } from '../../support/qa/address-autocomplete'

const address = '123 Synthetic Street'

async function modernWidget(page: Page, mode: 'open' | 'closed', select = true) {
	await page.setContent('<form><gmp-place-autocomplete id="fasd_address"></gmp-place-autocomplete></form>')
	await page.evaluate(({ mode, select }) => {
		customElements.define('gmp-place-autocomplete', class extends HTMLElement {
			constructor() {
				super()
				const shadow = this.attachShadow({ mode })
				shadow.innerHTML = '<style>:host{display:inline-block}input{width:300px}</style><input><div role="option" part="prediction-item" hidden>123 Synthetic Street</div>'
				const input = shadow.querySelector('input')!
				const option = shadow.querySelector<HTMLElement>('[role="option"]')!
				let active = false
				input.addEventListener('input', () => { setTimeout(() => { option.hidden = false }, 50) })
				const selected = () => {
					if (!select) return
					this.setAttribute('data-selected', input.value)
					option.hidden = true
					this.dispatchEvent(new Event('gmp-select'))
				}
				option.addEventListener('click', selected)
				input.addEventListener('keydown', event => {
					if (event.key === 'ArrowDown' && !option.hidden) active = true
					if (event.key === 'Enter') { event.preventDefault(); if (active) selected() }
				})
			}
		})
	}, { mode, select })
}

test('selects a legacy address suggestion before returning', async ({ page }) => {
	await page.setContent('<input id="fasd_address"><div class="pac-item" hidden>123 Synthetic Street</div>')
	await page.evaluate(() => {
		const input = document.querySelector('input')!
		const suggestion = document.querySelector<HTMLElement>('.pac-item')!
		input.addEventListener('input', () => { suggestion.hidden = false })
		suggestion.addEventListener('click', () => { input.dataset.selected = input.value })
	})
	await selectAutocompleteAddress(page, page.locator('#fasd_address'), address)
	await expect(page.locator('#fasd_address')).toHaveAttribute('data-selected', address)
})

for (const mode of ['open', 'closed'] as const) {
	test(`selects a real prediction in a ${mode} shadow widget`, async ({ page }) => {
		await modernWidget(page, mode)
		await selectAutocompleteAddress(page, page.locator('#fasd_address'), address)
		await expect(page.locator('#fasd_address')).toHaveAttribute('data-selected', address)
		await expect(page.locator('#fasd_address')).not.toHaveAttribute('data-qa-address-selection')
	})
}

test('does not accept typed text without a Google selection event', async ({ page }) => {
	await modernWidget(page, 'open', false)
	await expect(selectAutocompleteAddress(page, page.locator('#fasd_address'), address, 300))
		.rejects.toThrow('ADDRESS_AUTOCOMPLETE_FAILED')
	await expect(page.locator('#fasd_address')).not.toHaveAttribute('data-selected')
})

test('closed widget selection cannot submit the surrounding form', async ({ page }) => {
	await modernWidget(page, 'closed')
	const widget = page.locator('#fasd_address')
	await widget.evaluate(element => {
		const form = element.closest('form')!
		form.action = 'about:blank#submitted'
		element.addEventListener('gmp-select', () => { form.requestSubmit() })
	})
	await selectAutocompleteAddress(page, widget, address)
	await expect(widget).toHaveAttribute('data-selected', address)
	expect(page.url()).toBe('about:blank')
	await page.locator('form').evaluate(form => (form as HTMLFormElement).requestSubmit())
	await expect(page).toHaveURL(/#submitted$/)
})

test('reports an uninitialized custom element without trying to fill its host', async ({ page }) => {
	await page.setContent('<gmp-place-autocomplete id="fasd_address" style="display:block;width:300px;height:50px"></gmp-place-autocomplete>')
	await expect(selectAutocompleteAddress(page, page.locator('#fasd_address'), address, 300))
		.rejects.toThrow('ADDRESS_WIDGET_UNAVAILABLE')
})

test('reports the referrer denial without echoing the Google message or key', async ({ page }) => {
	await page.setContent('<input id="fasd_address">')
	await page.evaluate(() => {
		document.querySelector('input')!.addEventListener('input', () => {
			console.error('Google Maps JavaScript API error: RefererNotAllowedMapError SECRET_KEY_CANARY')
		})
	})
	const emitter = page as unknown as { listenerCount: (event: string) => number }
	const before = emitter.listenerCount('console')
	await expect(selectAutocompleteAddress(page, page.locator('#fasd_address'), address, 500))
		.rejects.toThrow(/^ADDRESS_REFERRER_DENIED$/)
	expect(emitter.listenerCount('console')).toBe(before)
})

test('reports blocked Places requests as an API configuration error', async ({ page }) => {
	await modernWidget(page, 'open')
	const placesUrl = 'https://places.googleapis.com/$rpc/google.maps.places.v1.Places/AutocompletePlaces'
	await page.route(placesUrl, route => route.fulfill({ status: 403, headers: { 'access-control-allow-origin': '*' } }))
	const widget = page.locator('#fasd_address')
	await widget.evaluate((element, url) => {
		element.shadowRoot!.querySelector('input')!.addEventListener('input', () => { void fetch(url) })
	}, placesUrl)
	await expect(selectAutocompleteAddress(page, widget, address))
		.rejects.toThrow(/^ADDRESS_API_CONFIGURATION$/)
})

test('missing legacy suggestions fail instead of submitting an unresolved address', async ({ page }) => {
	await page.setContent('<input id="fasd_address">')
	await expect(selectAutocompleteAddress(page, page.locator('#fasd_address'), address, 300))
		.rejects.toThrow('ADDRESS_AUTOCOMPLETE_FAILED')
})
