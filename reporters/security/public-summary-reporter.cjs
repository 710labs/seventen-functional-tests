const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { assertRecordingOff } = require('../../scripts/security/recording-policy')
const { runStatus } = require('../../scripts/security/summary')

// No titles, errors, stdout, URLs, attachments, or browser data cross this boundary.
const testId = test => createHash('sha256').update(test.id).digest('hex').slice(0, 16)
class PublicSummaryReporter {
	constructor() { this.tests = new Map(); this.errors = 0 }
	printsToStdio() { return true }
	onStdOut() {}
	onStdErr() {}
	onError() { this.errors++ }
	onBegin(config) {
		try {
			for (const project of config.projects) assertRecordingOff(project.use, true)
		} catch {
			// Playwright catches reporter exceptions and continues. Stop the child
			// process before workers launch, after persisting a safe failure summary.
			try {
				this.onEnd({ status: 'failed' })
			} finally {
				process.exit(1)
			}
		}
	}
	onTestEnd(test, result) {
		this.tests.set(test.id, { test, durationMs: result.duration, retries: result.retry })
	}
	onEnd(result) {
		const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 }
		const outcomes = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' }
		const tests = [...this.tests.values()].map(({ test, durationMs, retries }) => {
			const status = outcomes[test.outcome()] || 'failed'
			counts[status]++
			return { id: testId(test), status, durationMs, retries }
		})
		const summary = {
			schemaVersion: 1,
			status: runStatus(this.errors ? 'failed' : result.status, counts),
			counts, tests,
		}
		if (process.env.PUBLIC_SUMMARY_FILE) {
			fs.mkdirSync(path.dirname(process.env.PUBLIC_SUMMARY_FILE), { recursive: true })
			fs.writeFileSync(process.env.PUBLIC_SUMMARY_FILE, JSON.stringify(summary) + '\n', { mode: 0o600 })
		}
		console.log(JSON.stringify(summary))
		return { status: summary.status }
	}
}
module.exports = PublicSummaryReporter
module.exports.testId = testId
