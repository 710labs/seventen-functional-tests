import { expect, test, type Page } from '@playwright/test'
import { CreateAccountPage } from '../../models/create-account-page'
import { MyAccountPage } from '../../models/my-account-page'
import { selectAutocompleteAddress } from '../../support/qa/address-autocomplete'

const address = '123 Synthetic Street'

function defineAddressWidget({ mode, select }: { mode: 'open' | 'closed'; select: boolean }) {
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
				const form = this.closest('form')
				for (const [field, value] of Object.entries({ billing_address_1: input.value, billing_state: 'CA', billing_postcode: '90210' })) {
					const resolved = form?.querySelector<HTMLInputElement>(`[name="${field}"]`)
					if (resolved) resolved.value = value
				}
				this.dispatchEvent(new Event('gmp-select'))
			}
			option.addEventListener('click', selected)
			input.addEventListener('keydown', event => {
				if (event.key === 'ArrowDown' && !option.hidden) active = true
				if (event.key === 'Enter') { event.preventDefault(); if (active) selected() }
			})
		}
	})
}

async function modernWidget(page: Page, mode: 'open' | 'closed', select = true) {
	await page.setContent('<form><gmp-place-autocomplete id="fasd_address"></gmp-place-autocomplete></form>')
	await page.evaluate(defineAddressWidget, { mode, select })
}

const modernBillingFields = `
	<input name="billing_address_1" id="billing_address_1" hidden>
	<input name="billing_state" hidden>
	<input name="billing_postcode" id="billing_postcode" hidden>
	<gmp-place-autocomplete id="billing_address_1_place"></gmp-place-autocomplete>`

test.describe('List billing address with a hidden WooCommerce input', () => {
	test.use({ baseURL: 'https://list-address.test' })
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(defineAddressWidget, { mode: 'open', select: true })
	})

	test('registration resolves the widget address before reaching eligibility', async ({ page }) => {
		await page.route('https://list-address.test/', route => route.fulfill({
			contentType: 'text/html', body: '<a href="/register/">Create an account</a>',
		}))
		await page.route('https://list-address.test/register/', route => route.fulfill({
			contentType: 'text/html', body: `<form action="/eligibility/">
				<input name="email"><input name="password"><input name="svntn_core_registration_firstname">
				<input name="svntn_core_registration_lastname"><input name="billing_phone">
				<select name="svntn_core_dob_month"><option>12</option></select>
				<select name="svntn_core_dob_day"><option>16</option></select>
				<select name="svntn_core_dob_year"><option>1988</option></select>
				${modernBillingFields}<button>Next</button>
			</form>`,
		}))
		await page.route(/\/eligibility\/\?/, route => route.fulfill({
			contentType: 'text/html', body: `<button>Register</button>
				<label>Recreational <input type="radio" name="svntn_last_usage_type"></label>
				<input type="file" name="svntn_core_personal_doc">`,
		}))

		await page.goto('/')
		await new CreateAccountPage(page).reachPersonalDocumentUpload({
			address, state: 'CA', zipCode: '90210', email: 'synthetic@example.test',
			password: 'synthetic-test-password', firstName: 'Test', lastName: 'Customer',
		})
		const submitted = new URL(page.url()).searchParams
		expect(submitted.get('billing_address_1')).toBe(address)
		expect(submitted.get('billing_postcode')).toBe('90210')
	})

	test('an existing customer saves the address selected in the widget', async ({ page }) => {
		const pages: Record<string, string> = {
			'/my-account/': '<a href="/address-book/">Address Book</a>',
			'/address-book/': '<section>Billing address <a href="/billing/">Edit</a></section>',
			'/billing/': `<form action="/saved/">${modernBillingFields}<button>Save address</button></form>`,
			'/saved/': 'Address saved',
		}
		await page.route('https://list-address.test/**', route => route.fulfill({
			contentType: 'text/html', body: pages[new URL(route.request().url()).pathname] ?? '',
		}))

		await new MyAccountPage(page).addAddress(address, 'Beverly Hills', 'CA', '90210')
		await expect(page).toHaveURL(/\/saved\/\?/)
		const submitted = new URL(page.url()).searchParams
		expect(submitted.get('billing_address_1')).toBe(`${address}, Beverly Hills, CA 90210`)
		expect(submitted.get('billing_postcode')).toBe('90210')
	})
})

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
