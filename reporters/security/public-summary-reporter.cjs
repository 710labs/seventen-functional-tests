const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { assertRecordingOff } = require('../../scripts/security/recording-policy')
const { runStatus } = require('../../scripts/security/summary')
const { testFailure } = require('../../scripts/security/failure-diagnostics')
const { reportingOutcome, isQueuedTest } = require('../../scripts/security/queueit-status')
const { readSession } = require('../../scripts/hosted-reports/session')
const { HostedReport } = require('../../scripts/hosted-reports/report')

// No titles, errors, stdout, URLs, attachments, or browser data cross this boundary.
const testId = test => createHash('sha256').update(test.id).digest('hex').slice(0, 16)
class PublicSummaryReporter {
	constructor() { this.tests = new Map(); this.errors = 0; this.privateErrors = [] }
	printsToStdio() { return true }
	onStdOut() {}
	onStdErr() {}
	onError(error) { this.errors++; this.privateErrors.push(error); this.hostedReport?.onError(error) }
	onBegin(config, suite) {
		try {
			for (const project of config.projects) assertRecordingOff(project.use, true)
			const session = readSession()
			if (session) {
				this.hostedReport = new HostedReport(session)
				this.hostedReport.onBegin(config, suite)
				for (const error of this.privateErrors) this.hostedReport.onError(error)
			}
		} catch {
			// Playwright catches reporter exceptions and continues. Stop the child
			// process before workers launch, after persisting a safe failure summary.
			try {
				this.hostedReport = null
				this.writeSummary({ status: 'failed' })
			} finally {
				process.exit(1)
			}
		}
	}
	onTestEnd(test, result) {
		this.tests.set(test.id, { test, durationMs: result.duration, retries: result.retry })
	}
	onEnd(result) {
		if (this.hostedReport) return this.hostedReport.finish(result).then(report => this.writeSummary(result, report))
		return this.writeSummary(result)
	}
	writeSummary(result, hostedReport) {
		const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 }
		const outcomes = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' }
		const tests = [...this.tests.values()].map(({ test, durationMs, retries }) => {
			const status = isQueuedTest(test) ? 'queued' : outcomes[reportingOutcome(test)] || 'failed'
			counts[status] = (counts[status] || 0) + 1
			return { id: testId(test), status, durationMs, retries,
				...(['failed', 'flaky'].includes(status) ? { failure: testFailure(test) } : {}) }
		})
		const summary = {
			schemaVersion: 1,
			status: runStatus(this.errors || hostedReport?.failed ? 'failed' : result.status, counts),
			counts, tests,
			...(hostedReport ? { hostedReport } : {}),
		}
		if (process.env.PUBLIC_SUMMARY_FILE) {
			fs.mkdirSync(path.dirname(process.env.PUBLIC_SUMMARY_FILE), { recursive: true })
			fs.writeFileSync(process.env.PUBLIC_SUMMARY_FILE, JSON.stringify(summary) + '\n', { mode: 0o600 })
		}
		console.log(JSON.stringify(summary))
		return { status: summary.status === 'queued' ? 'passed' : summary.status }
	}
}
module.exports = PublicSummaryReporter
module.exports.testId = testId
