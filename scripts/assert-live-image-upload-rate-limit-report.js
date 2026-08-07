const fs = require('fs')

const ATTEMPT_COUNTERS = [
	'live.image_upload.accepted',
	'live.image_upload.rate_limited',
	'live.image_upload.unexpected_error',
]

function getCounters(report) {
	return report?.aggregate?.counters || {}
}

function counterValue(counters, name) {
	const value = counters[name]

	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function parseExpectedAttempts(value) {
	const parsed = Number.parseInt(value, 10)

	if (!Number.isFinite(parsed) || parsed < 1) {
		throw new Error(`Expected upload attempts must be a positive integer; received ${value}`)
	}

	return parsed
}

function assertLiveImageUploadRateLimitReport(report, expectedAttempts) {
	const counters = getCounters(report)
	const created = counterValue(counters, 'vusers.created')
	const completed = counterValue(counters, 'vusers.completed')
	const failed = counterValue(counters, 'vusers.failed')
	const attempts = Object.fromEntries(
		ATTEMPT_COUNTERS.map(name => [name, counterValue(counters, name)]),
	)
	const executedAttempts = Object.values(attempts).reduce((total, value) => total + value, 0)
	const errors = []

	if (created !== 1) {
		errors.push(`expected exactly 1 created VU, received ${created}`)
	}

	if (completed !== 1) {
		errors.push(`expected exactly 1 completed VU, received ${completed}`)
	}

	if (failed !== 0) {
		errors.push(`expected 0 failed VUs, received ${failed}`)
	}

	if (executedAttempts !== expectedAttempts) {
		errors.push(
			`expected ${expectedAttempts} classified upload attempts, received ${executedAttempts}`,
		)
	}

	const summary = {
		attempts,
		created,
		completed,
		executedAttempts,
		expectedAttempts,
		failed,
	}

	if (errors.length > 0) {
		throw new Error(
			`Live image upload rate-limit scenario was incomplete: ${errors.join('; ')}. Counters: ${JSON.stringify(summary)}`,
		)
	}

	return summary
}

function loadReport(reportPath) {
	if (!reportPath) {
		throw new Error('An Artillery report path is required')
	}

	return JSON.parse(fs.readFileSync(reportPath, 'utf8'))
}

function main() {
	const reportPath = process.argv[2] || process.env.ARTILLERY_REPORT_JSON
	const expectedAttempts = parseExpectedAttempts(
		process.argv[3] || process.env.ARTILLERY_UPLOAD_ATTEMPTS,
	)
	const summary = assertLiveImageUploadRateLimitReport(loadReport(reportPath), expectedAttempts)

	console.log(`Live image upload rate-limit scenario completed: ${JSON.stringify(summary)}`)
}

if (require.main === module) {
	try {
		main()
	} catch (error) {
		console.error(`[live-rate-limit-report] ${error.message}`)
		process.exitCode = 1
	}
}

module.exports = {
	ATTEMPT_COUNTERS,
	assertLiveImageUploadRateLimitReport,
	getCounters,
	parseExpectedAttempts,
}
