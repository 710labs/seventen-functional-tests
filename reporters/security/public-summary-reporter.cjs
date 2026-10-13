const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')

// No titles, errors, stdout, URLs, attachments, or browser data cross this boundary.
const testId = test => createHash('sha256').update(test.id).digest('hex').slice(0, 16)
class PublicSummaryReporter {
	constructor() { this.tests = new Map(); this.errors = 0 }
	printsToStdio() { return true }
	onStdOut() {}
	onStdErr() {}
	onError() { this.errors++ }
	onBegin(config) {
		for (const project of config.projects) {
			if (['trace', 'video', 'screenshot'].some(key => project.use[key] !== 'off')) {
				throw new Error('Browser recording is prohibited by the public reporting policy.')
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
			status: result.status === 'passed' && !this.errors && !counts.failed && counts.passed + counts.flaky > 0 ? 'passed' : 'failed',
			counts, tests,
		}
		if (process.env.PUBLIC_SUMMARY_FILE) {
			fs.mkdirSync(path.dirname(process.env.PUBLIC_SUMMARY_FILE), { recursive: true })
			fs.writeFileSync(process.env.PUBLIC_SUMMARY_FILE, JSON.stringify(summary) + '\n', { mode: 0o600 })
		}
		console.log(JSON.stringify(summary))
	}
}
module.exports = PublicSummaryReporter
module.exports.testId = testId
