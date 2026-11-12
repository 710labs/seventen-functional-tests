const assert = require('node:assert/strict')
const test = require('node:test')
const { chromium } = require('@playwright/test')

const {
	acceptPickupCommitment,
	isCheckoutSubmissionUrl,
	selectResolvedBillingAddress,
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
