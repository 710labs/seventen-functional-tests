const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { cancelOrders, markCleanupFailure, readOrderIds } = require('./cleanup-production-orders')
const { getCheck, readResult, writeResult } = require('./result-utils')

test('production order cleanup deduplicates IDs across both smoke-test files', () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-order-cleanup-'))
	const first = path.join(directory, 'order_ids.txt')
	const second = path.join(directory, 'order_id.txt')
	fs.writeFileSync(first, '123\n456\n123\n')
	fs.writeFileSync(second, '456\n789\n')
	assert.deepEqual(readOrderIds([first, second]), ['123', '456', '789'])
})

test('production order cleanup sends authenticated cancellation requests', async () => {
	const requests = []
	await cancelOrders({
		ids: ['123', '456'],
		baseUrl: 'https://example.com',
		consumerKey: 'key',
		consumerSecret: 'secret',
		fetchImpl: async (url, options) => {
			requests.push({ url: String(url), options })
			return { ok: true, status: 200 }
		},
	})
	assert.deepEqual(requests.map(request => request.url), [
		'https://example.com/wp-json/wc/v3/orders/123',
		'https://example.com/wp-json/wc/v3/orders/456',
	])
	assert.equal(requests[0].options.method, 'PUT')
	assert.equal(
		requests[0].options.headers.Authorization,
		`Basic ${Buffer.from('key:secret').toString('base64')}`,
	)
	assert.equal(requests[0].options.body, JSON.stringify({ status: 'cancelled' }))
})

test('a cleanup error changes an otherwise passing health result to failed', () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prod-order-result-'))
	const outputFile = path.join(directory, 'list-prod-ca.json')
	const check = getCheck('list-prod-ca')
	writeResult(check, { status: 'passed', failureSummary: [] }, outputFile)
	markCleanupFailure(check, new Error('HTTP 500'), outputFile)
	const result = readResult(outputFile)
	assert.equal(result.status, 'failed')
	assert.match(result.failureSummary.at(-1), /HTTP 500/)
})
