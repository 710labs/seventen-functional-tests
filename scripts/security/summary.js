const { sanitizeFailure } = require('./failure-diagnostics')
const { safeConsoleUrl } = require('../private-videos/session')
const number = value => {
	if (!Number.isFinite(value) || value < 0) throw new Error('Invalid summary number')
	return value
}
function runStatus(status, counts) {
	if (status === 'passed' && counts.failed === 0 && counts.queued > 0) return 'queued'
	return status === 'passed' && counts.failed === 0 && counts.passed + (counts.flaky || 0) > 0
		? 'passed'
		: 'failed'
}
function sanitizeSummary(input) {
	if (!['passed', 'failed', 'queued'].includes(input.status) || input.schemaVersion !== 1 || !Array.isArray(input.tests)) throw new Error('Invalid summary')
	const counts = Object.fromEntries(['passed', 'failed', 'flaky', 'skipped'].map(key => [key, number(input.counts[key])]))
	if (input.counts.queued !== undefined) counts.queued = number(input.counts.queued)
	const tests = input.tests.map(test => {
		if (!/^[a-f0-9]{16}$/.test(test.id) || !Object.hasOwn(counts, test.status)) throw new Error('Invalid test summary')
		return { id: test.id, status: test.status, durationMs: number(test.durationMs), retries: number(test.retries),
			...((test.status === 'failed' || test.status === 'flaky') && test.failure ? { failure: sanitizeFailure(test.failure) } : {}) }
	})
	return { schemaVersion: 1, status: input.status, counts, tests,
		...(input.recordings ? { recordings: sanitizeRecordings(input.recordings) } : {}) }
}
function sanitizeRecordings(input) {
	if (!['complete', 'incomplete'].includes(input.status)) throw new Error('Invalid recording status')
	const recordings = { status: input.status, uploaded: number(input.uploaded), failed: number(input.failed), missing: number(input.missing) }
	if (input.url) {
		const url = safeConsoleUrl(input.url)
		if (!url) throw new Error('Invalid private recording link')
		recordings.url = url
	}
	if (input.videos) recordings.videos = input.videos.map(video => {
		const url = safeConsoleUrl(video.url)
		if (!/^[a-f0-9]{16}$/.test(video.id) || !url) throw new Error('Invalid private recording')
		return { id: video.id, retry: number(video.retry), url }
	})
	return recordings
}
function readRecordingSummary() {
	try {
		const input = JSON.parse(require('node:fs').readFileSync(process.env.PUBLIC_SUMMARY_FILE, 'utf8'))
		return input.recordings ? sanitizeRecordings(input.recordings) : null
	} catch { return null }
}
module.exports = { sanitizeSummary, sanitizeRecordings, readRecordingSummary, runStatus }
