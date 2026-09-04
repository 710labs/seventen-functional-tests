const assert = require('node:assert/strict')
const test = require('node:test')

const {
	acceptPickupCommitment,
	isCheckoutSubmissionUrl,
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
