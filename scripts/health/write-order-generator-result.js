const path = require('node:path')
const { getCheck, writeResult } = require('./result-utils')
const { summarize } = require('../live-order-generator/summarize.cjs')

function buildResult(orderBatch, jobStatus = 'success') {
	const passed = orderBatch.orders.filter(order => order.status === 'verified').length
	const failures = orderBatch.orders.filter(order => order.status !== 'verified')
	const runnerFailed = jobStatus !== 'success'
	const status = orderBatch.status === 'passed' && !runnerFailed ? 'passed' : 'failed'
	const finishedAt = new Date().toISOString()
	return {
		status,
		startedAt: orderBatch.batchCreatedAt || finishedAt,
		finishedAt,
		durationSeconds: orderBatch.batchCreatedAt ? Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(orderBatch.batchCreatedAt)) / 1000)) : 0,
		counts: { passed, failed: failures.length, flaky: 0, skipped: 0 },
		failureSummary: [
			...(runnerFailed ? ['Order generator workflow did not complete successfully.'] : []),
			...failures.map(order => `${order.pos} ${order.customerType}: ${order.status} (${order.phase})`),
		],
		details: { orderBatch },
	}
}

if (require.main === module) {
	const check = getCheck('live-stage-order-generator')
	const result = buildResult(summarize(path.resolve('output/live-order-generator'), 'all'), process.env.GENERATOR_JOB_STATUS || 'success')
	writeResult(check, result)
	process.exitCode = result.status === 'passed' ? 0 : 1
}

module.exports = { buildResult }
