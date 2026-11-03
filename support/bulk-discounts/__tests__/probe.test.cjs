const { test } = require('node:test')
const assert = require('node:assert/strict')
const { probeStoreApi } = require('../../../scripts/bulk-discounts/probe.cjs')
const { DEV_ORIGIN } = require('../dev-only.cjs')

test('probe checks schema without returning response data', async () => {
	const result = await probeStoreApi(DEV_ORIGIN, async (url, options) => {
		assert.equal(url, `${DEV_ORIGIN}/wp-json/wc/store/v1/cart`)
		assert.equal(options.redirect, 'manual')
		return { ok: true, status: 200, json: async () => ({ coupons: [], totals: { tax_lines: [], total_price: '0' }, billing_address: { email: 'synthetic@example.invalid' } }) }
	})
	assert.deepEqual(result, { authenticated: false, status: 200, hasCoupons: true, hasTaxLines: true, hasTotals: true })
})

test('non-dev targets fail before any request', async () => {
	let requested = false
	await assert.rejects(() => probeStoreApi('https://thelist.710labs.com', async () => { requested = true }), /BULK_DEV_ONLY/)
	assert.equal(requested, false)
})

test('redirects and non-JSON responses fail closed', async () => {
	await assert.rejects(() => probeStoreApi(DEV_ORIGIN, async () => ({ ok: false, status: 302 })), /BULK_PROBE_HTTP_302/)
	await assert.rejects(() => probeStoreApi(DEV_ORIGIN, async () => ({ ok: true, status: 200, json: async () => { throw new Error('synthetic response body') } })), /BULK_PROBE_NOT_JSON/)
	await assert.rejects(() => probeStoreApi(DEV_ORIGIN, async () => ({ ok: true, status: 200, json: async () => ({}) })), /BULK_PROBE_SCHEMA_MISSING/)
})
