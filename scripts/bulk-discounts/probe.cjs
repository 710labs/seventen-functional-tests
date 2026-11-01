const { assertDevBaseUrl } = require('../../support/bulk-discounts/dev-only.cjs')

async function probeStoreApi(baseUrl, fetchImpl = fetch) {
	const origin = assertDevBaseUrl(baseUrl)
	const response = await fetchImpl(`${origin}/wp-json/wc/store/v1/cart`, {
		redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' },
	})
	// Never follow a redirect, even when it appears to point back to dev.
	if (!response.ok) throw new Error(`BULK_PROBE_HTTP_${response.status}`)
	let body
	try { body = await response.json() } catch { throw new Error('BULK_PROBE_NOT_JSON') }
	const result = {
		authenticated: false,
		status: response.status,
		hasCoupons: Array.isArray(body?.coupons),
		hasTaxLines: Array.isArray(body?.totals?.tax_lines),
		hasTotals: typeof body?.totals?.total_price === 'string',
	}
	if (!result.hasCoupons || !result.hasTaxLines || !result.hasTotals) throw new Error('BULK_PROBE_SCHEMA_MISSING')
	return result
}

if (require.main === module) {
	probeStoreApi(process.env.BULK_BASE_URL).then(result => console.log(JSON.stringify(result))).catch(error => {
		// No response bodies, request headers, cookies, URLs, or raw network errors.
		const code = /^BULK_[A-Z_0-9]+$/.test(error.message) ? error.message : 'BULK_PROBE_NETWORK_FAILED'
		console.error(code)
		process.exitCode = 1
	})
}

module.exports = { probeStoreApi }
