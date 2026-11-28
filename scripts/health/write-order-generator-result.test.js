const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildResult } = require('./write-order-generator-result')
const { summarize } = require('../live-order-generator/summarize.cjs')

test('order generator health passes only when both the complete batch and workflow pass', () => {
	const batch = { status: 'passed', orders: Array.from({ length: 8 }, () => ({ status: 'verified' })) }
	assert.equal(buildResult(batch).status, 'passed')
	assert.equal(buildResult(batch).counts.passed, 8)
	for (const jobStatus of ['failure', 'cancelled', 'skipped']) {
		const result = buildResult(batch, jobStatus)
		assert.equal(result.status, 'failed')
		assert.equal(result.failureSummary.length, 1)
	}
	assert.equal(buildResult({ ...batch, status: 'failed' }).status, 'failed')
})

test('missing setup and partially created batches stay failed with all eight slots visible', () => {
	const batch = summarize('/nonexistent-live-order-generator-test-directory')
	const result = buildResult(batch, 'failure')
	assert.equal(result.status, 'failed')
	assert.equal(result.counts.failed, 8)
	assert.equal(result.details.orderBatch.orders.length, 8)
	const partial = { ...batch, orders: batch.orders.map((order, index) => ({ ...order,
		status: index === 0 ? 'verified' : index === 1 ? 'created' : order.status })) }
	const partialResult = buildResult(partial)
	assert.equal(partialResult.status, 'failed')
	assert.equal(partialResult.counts.passed, 1)
	assert.equal(partialResult.counts.failed, 7)
})
