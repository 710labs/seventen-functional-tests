import fs from 'fs'
import path from 'path'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

const { testId } = require('../security/public-summary-reporter.cjs')
const { runStatus, readRecordingSummary } = require('../../scripts/security/summary')
const { failureLabel, testFailure } = require('../../scripts/security/failure-diagnostics')
const { reportingOutcome, isQueuedTest, QUEUEIT_REASON } = require('../../scripts/security/queueit-status')

type Outcome = 'passed' | 'failed' | 'skipped'

class HealthJsonReporter implements Reporter {
	private startedAt = Date.now()
	private tests = new Map<string, TestCase>()

	onTestEnd(test: TestCase, _result: TestResult) {
		if (!process.env.HEALTH_RESULT_FILE) return
		this.tests.set(test.id, test)
	}

	onEnd(result: FullResult) {
		const outputFile = process.env.HEALTH_RESULT_FILE
		if (!outputFile) return

		const counts: Record<Outcome, number> & { queued?: number } = {
			passed: 0,
			failed: 0,
			skipped: 0,
		}
		const failures: string[] = []
		const diagnostics = []

		for (const test of this.tests.values()) {
			const outcome = reportingOutcome(test)
			if (isQueuedTest(test)) counts.queued = (counts.queued || 0) + 1
			else if (outcome === 'expected') counts.passed++
			else if (outcome === 'unexpected') {
				counts.failed++
				failures.push(`Test ${testId(test)}: ${failureLabel(test)}`)
				diagnostics.push({ id: testId(test), ...testFailure(test) })
			} else if (outcome === 'flaky') {
				// A retry recovered the test, so health reporting treats the final outcome as passed.
				counts.passed++
			} else counts.skipped++
		}

		const executed = counts.passed + counts.failed + (counts.queued || 0)
		if (executed === 0) failures.push('No tests executed.')
		const recordings = readRecordingSummary()
		if (recordings?.failed) failures.push('Private failure video upload was incomplete.')
		const status = runStatus(recordings?.failed ? 'failed' : result.status, counts)
		const reportUrl = recordings?.url || null
		const runUrl =
			process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
				? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
				: null

		const payload = {
			schemaVersion: 1,
			id: process.env.HEALTH_CHECK_ID,
			label: process.env.HEALTH_CHECK_LABEL,
			group: process.env.HEALTH_CHECK_GROUP,
			status,
			...(counts.queued ? { queueSummary: QUEUEIT_REASON } : {}),
			startedAt: new Date(this.startedAt).toISOString(),
			finishedAt: new Date().toISOString(),
			durationSeconds: Math.round((Date.now() - this.startedAt) / 1000),
			counts,
			failureSummary: failures.slice(0, 20),
			diagnostics: diagnostics.slice(0, 20),
			reportUrl,
			...(recordings ? { recordings } : {}),
			runUrl,
		}

		fs.mkdirSync(path.dirname(outputFile), { recursive: true })
		fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`)
	}
}

export default HealthJsonReporter
