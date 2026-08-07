const assert = require('node:assert/strict')
const test = require('node:test')
const {
	assertLiveImageUploadRateLimitReport,
	parseExpectedAttempts,
} = require('./assert-live-image-upload-rate-limit-report')

function reportWithCounters(counters) {
	return {
		aggregate: {
			counters,
		},
	}
}

test('accepts one completed VU with every upload attempt classified', () => {
	const summary = assertLiveImageUploadRateLimitReport(
		reportWithCounters({
			'live.image_upload.accepted': 9,
			'live.image_upload.rate_limited': 1,
			'vusers.completed': 1,
			'vusers.created': 1,
		}),
		10,
	)

	assert.equal(summary.executedAttempts, 10)
	assert.equal(summary.failed, 0)
})

test('rejects a green Artillery command with a failed VU and no upload attempts', () => {
	assert.throws(
		() =>
			assertLiveImageUploadRateLimitReport(
				reportWithCounters({
					'vusers.created': 1,
					'vusers.failed': 1,
				}),
				70,
			),
		/error.*expected exactly 1 completed VU.*expected 0 failed VUs.*expected 70 classified upload attempts/i,
	)
})

test('rejects a completed VU that executed fewer attempts than requested', () => {
	assert.throws(
		() =>
			assertLiveImageUploadRateLimitReport(
				reportWithCounters({
					'live.image_upload.accepted': 4,
					'vusers.completed': 1,
					'vusers.created': 1,
				}),
				5,
			),
		/expected 5 classified upload attempts, received 4/,
	)
})

test('requires a positive expected-attempt count', () => {
	assert.equal(parseExpectedAttempts('70'), 70)
	assert.throws(() => parseExpectedAttempts('0'), /positive integer/)
	assert.throws(() => parseExpectedAttempts('abc'), /positive integer/)
})
