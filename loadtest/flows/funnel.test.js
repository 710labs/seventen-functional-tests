const assert = require('node:assert/strict')
const test = require('node:test')
const { chromium } = require('@playwright/test')
const { summarizeReport } = require('../../scripts/summarize-artillery-report')

const {
	acceptPickupCommitment,
	isCheckoutSubmissionUrl,
	selectResolvedBillingAddress,
	storeFunnelMixed,
	submitRegistrationForm,
	waitForCheckoutReadyToSubmit,
} = require('./funnel')

function createPickupCommitmentPage({ visible = true, checked = false } = {}) {
	let currentChecked = checked
	let checkCalls = 0
	const checkbox = {
		first() {
			return this
		},
		async waitFor() {
			if (!visible) {
				throw new Error('not visible')
			}
		},
		async isVisible() {
			return visible
		},
		async isEnabled() {
			return true
		},
		async isChecked() {
			return currentChecked
		},
		async check() {
			checkCalls += 1
			currentChecked = true
		},
	}

	return {
		page: {
			locator(selector) {
				assert.equal(selector, '#pickup_commitment')
				return checkbox
			},
			async waitForTimeout() {},
		},
		getCheckCalls: () => checkCalls,
	}
}

test('acceptPickupCommitment checks a visible pickup requirement', async () => {
	const { page, getCheckCalls } = createPickupCommitmentPage()

	assert.equal(await acceptPickupCommitment(page), true)
	assert.equal(getCheckCalls(), 1)
})

test(
	'acceptPickupCommitment leaves delivery checkout unchanged when the requirement is hidden',
	async () => {
		const { page, getCheckCalls } = createPickupCommitmentPage({ visible: false })

		assert.equal(await acceptPickupCommitment(page), false)
		assert.equal(getCheckCalls(), 0)
	},
)

test('isCheckoutSubmissionUrl matches only the WooCommerce checkout endpoint', () => {
	assert.equal(
		isCheckoutSubmissionUrl('https://thelist-stage.710labs.com/?wc-ajax=checkout'),
		true,
	)
	assert.equal(
		isCheckoutSubmissionUrl('https://thelist-stage.710labs.com/checkout/'),
		false,
	)
	assert.equal(isCheckoutSubmissionUrl('not a url'), false)
})

test('waitForCheckoutReadyToSubmit waits until checkout overlays clear', async () => {
	let overlayChecks = 0
	const placeOrderButton = {
		async isVisible() {
			return true
		},
		async isEnabled() {
			return true
		},
		async evaluate() {
			return true
		},
	}
	const page = {
		locator(selector) {
			assert.equal(selector, '.blockUI.blockOverlay:visible')
			return {
				async count() {
					overlayChecks += 1
					return overlayChecks === 1 ? 1 : 0
				},
			}
		},
		async waitForTimeout(milliseconds) {
			await new Promise(resolve => setTimeout(resolve, milliseconds))
		},
	}

	await waitForCheckoutReadyToSubmit(page, placeOrderButton, 1500)
	assert.ok(overlayChecks >= 2)
})

test('billing registration resolves both Google Places controls', async t => {
	const browser = await chromium.launch()
	t.after(() => browser.close())
	const address = '123 Synthetic Street'
	const resolvedAddress = '123 Synthetic St'
	const billingFields = '<input name="billing_state" type="hidden"><input name="billing_postcode" type="hidden">'

	await t.test('selects the visible legacy suggestion', async t => {
		const page = await browser.newPage()
		t.after(() => page.close())
		await page.setContent(`
			<input name="billing_address_1">
			${billingFields}
			<div class="pac-item" hidden>Old suggestion</div>
			<div class="pac-item" id="prediction" hidden>${resolvedAddress}</div>
			<script>
				const field = document.querySelector('[name="billing_address_1"]');
				const prediction = document.querySelector('#prediction');
				field.addEventListener('input', () => { prediction.hidden = false; });
				prediction.addEventListener('click', () => {
					field.value = prediction.textContent;
					document.querySelector('[name="billing_state"]').value = 'CA';
					document.querySelector('[name="billing_postcode"]').value = '90016';
				});
			</script>`)
		await selectResolvedBillingAddress(page, address, 'CA', '90016')
		assert.equal(await page.locator('[name="billing_address_1"]').inputValue(), resolvedAddress)
	})

	await t.test('uses the modern widget and verifies the hidden submitted address', async t => {
		const page = await browser.newPage()
		t.after(() => page.close())
		await page.setContent(`
			<input name="billing_address_1" hidden>
			${billingFields}
			<gmp-place-autocomplete id="billing_address_1_place"></gmp-place-autocomplete>
			<script>
				customElements.define('gmp-place-autocomplete', class extends HTMLElement {
					constructor() {
						super();
						const shadow = this.attachShadow({ mode: 'open' });
						shadow.innerHTML = '<input><div role="option" hidden>${resolvedAddress}</div>';
						const option = shadow.querySelector('[role="option"]');
						shadow.querySelector('input').addEventListener('input', () => { option.hidden = false; });
						option.addEventListener('click', () => {
							this.dispatchEvent(new Event('gmp-select'));
							setTimeout(() => {
								document.querySelector('[name="billing_address_1"]').value = option.textContent;
								document.querySelector('[name="billing_state"]').value = 'CA';
								document.querySelector('[name="billing_postcode"]').value = '90016';
							}, 100);
						});
					}
				});
			</script>`)
		await selectResolvedBillingAddress(page, address, 'CA', '90016')
		assert.equal(await page.locator('[name="billing_address_1"]').inputValue(), resolvedAddress)
	})
})

test('the mixed flow waits for eligibility after Next and reports registration timing', async t => {
	const browser = await chromium.launch()
	t.after(() => browser.close())
	const page = await browser.newPage()
	const requests = []
	const timings = []

	await page.route('https://registration.example/**', async route => {
		const { pathname } = new URL(route.request().url())
		const method = route.request().method()
		requests.push(`${method} ${pathname}`)
		if (method === 'POST' && pathname === '/register/') {
			return route.fulfill({
				contentType: 'text/html',
				body: "<script>location.replace('/')</script>",
			})
		}
		if (pathname === '/register/') {
			return route.fulfill({
				contentType: 'text/html',
				body: `<form method="post">
					<input name="billing_address_1" type="hidden" value="123 Synthetic St">
					<input name="billing_state" type="hidden" value="CA">
					<input name="billing_postcode" type="hidden" value="90016">
					<button type="submit">Next</button>
				</form>`,
			})
		}
		return route.fulfill({
			contentType: 'text/html',
			body: `<main>Shop</main><script>
				setTimeout(() => {
					document.querySelector('main').innerHTML =
						'<section id="eligibilityContext"><input type="submit" id="svntn_core_eligibility_post" value="Register" disabled></section>';
				}, 700);
			</script>`,
		})
	})

	await page.goto('https://registration.example/register/')
	const events = { emit: (...args) => timings.push(args) }
	const registrationSteps = ['Create Account', 'Submit Registration Form']
	await storeFunnelMixed(page, { vars: { target: 'https://registration.example' } }, events, {
		step: (name, run) => registrationSteps.includes(name) ? run() : undefined,
	})

	assert.equal(page.url(), 'https://registration.example/')
	assert.deepEqual(requests, ['GET /register/', 'POST /register/', 'GET /'])
	const registrationTimings = timings.filter(([, metric]) => metric.startsWith('registration.'))
	assert.equal(registrationTimings.length, 1)
	assert.deepEqual(registrationTimings[0].slice(0, 2), ['histogram', 'registration.eligible.response_ms'])
	assert.ok(registrationTimings[0][2] >= 0)
})

test('registration failures report request and validation outcomes without logging form data', { concurrency: true }, async t => {
	const browser = await chromium.launch()
	t.after(() => browser.close())
	const cases = [
		{ mode: 'invalid', message: 'no request seen, validation visible' },
		{ mode: 'form error', message: 'POST HTTP 200, validation visible', timing: 'response_ms' },
		{ mode: 'no eligibility', message: 'POST HTTP 200, validation none seen', timing: 'response_ms' },
		{ mode: 'forbidden', message: 'POST HTTP 403, validation none seen', timing: 'response_ms' },
		{ mode: 'network failure', message: 'possible POST network failure, validation none seen', timing: 'network_failure_ms' },
		{ mode: 'pending', message: 'possible POST pending, validation none seen', timing: 'pending_ms' },
	]

	await Promise.all(cases.map(({ mode, message, timing }) => t.test(mode, async subtest => {
		const page = await browser.newPage()
		subtest.after(() => page.close())
		const timings = []
		const ajax = mode === 'pending' || mode === 'network failure'
		const url = 'https://registration.example'
		await page.route(`${url}/**`, route => {
			const request = route.request()
			if (request.method() === 'POST') {
				if (mode === 'pending') return // Leave the intercepted request pending until the page closes.
				if (mode === 'network failure') return route.abort()
				return route.fulfill({
					status: mode === 'forbidden' ? 403 : 200,
					contentType: 'text/html',
					body: mode === 'form error' ? '<p class="woocommerce-error">Invalid private@example.test</p>' : '<p>Registration</p>',
				})
			}
			return route.fulfill({
				contentType: 'text/html',
				body: `<form method="post">
					<input name="billing_address_1" type="hidden" value="123 Synthetic St">
					<input name="billing_state" type="hidden" value="CA">
					<input name="billing_postcode" type="hidden" value="90016">
					<input name="email" type="email" required value="${mode === 'invalid' ? 'bad-email' : 'private@example.test'}">
					<button type="${ajax ? 'button' : 'submit'}">Next</button>
				</form>${ajax ? `<script>
					document.querySelector('button').onclick = () => fetch('/submit-registration', { method: 'POST' }).catch(() => {});
				</script>` : ''}`,
			})
		})
		await page.goto(`${url}/register/`)
		const baseline = page.eventNames().map(event => [event, page.listenerCount(event)])
		const expected = `Registration eligibility timed out at /register/ (${message}).`
		await assert.rejects(submitRegistrationForm(page, 'CA', '90016', { emit: (...args) => timings.push(args) }), { message: expected })
		assert.deepEqual(page.eventNames().map(event => [event, page.listenerCount(event)]), baseline)
		assert.equal(timings.length, timing ? 1 : 0)
		const summaries = {}
		if (timing) {
			const metric = `registration.failed.${timing}`
			assert.deepEqual(timings[0].slice(0, 2), ['histogram', metric])
			assert.ok(timings[0][2] >= 0)
			summaries[metric] = { p95: 123 }
		}
		const summary = summarizeReport({ aggregate: { counters: { [`errors.${expected}`]: 1 }, summaries } })
		assert.ok(summary.includes(`- ${expected}: 1`))
		if (timing) assert.ok(summary.includes(`registration.failed.${timing} p95: 123`))
	})))
})
