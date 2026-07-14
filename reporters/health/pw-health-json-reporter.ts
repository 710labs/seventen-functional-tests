import fs from 'fs'
import path from 'path'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

type Outcome = 'passed' | 'failed' | 'flaky' | 'skipped'

class HealthJsonReporter implements Reporter {
	private startedAt = Date.now()
	private tests = new Map<string, TestCase>()

	onTestEnd(test: TestCase, _result: TestResult) {
		this.tests.set(test.id, test)
	}

	onEnd(result: FullResult) {
		const outputFile = process.env.HEALTH_RESULT_FILE
		if (!outputFile) return

		const counts: Record<Outcome, number> = {
			passed: 0,
			failed: 0,
			flaky: 0,
			skipped: 0,
		}
		const failures: string[] = []

		for (const test of this.tests.values()) {
			const outcome = test.outcome()
			if (outcome === 'expected') counts.passed++
			else if (outcome === 'unexpected') {
				counts.failed++
				failures.push(`${test.title} [${test.parent.title}]`)
			} else if (outcome === 'flaky') {
				counts.flaky++
				failures.push(`${test.title} [${test.parent.title}]`)
			} else counts.skipped++
		}

		const executed = counts.passed + counts.failed + counts.flaky
		if (executed === 0) failures.push('No tests executed.')
		const status =
			result.status !== 'passed' || counts.failed > 0 || executed === 0
				? 'failed'
				: counts.flaky > 0
					? 'flaky'
					: 'passed'
		const rootKey = `${process.env.ENV_ID}-${process.env.UNIQUE_RUN_ID}-${process.env.RUN_ID}`
		const reportUrl =
			process.env.S3_BUCKET && process.env.S3_REGION
				? `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${rootKey}/index.html`
				: null
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
			startedAt: new Date(this.startedAt).toISOString(),
			finishedAt: new Date().toISOString(),
			durationSeconds: Math.round((Date.now() - this.startedAt) / 1000),
			counts,
			failureSummary: failures.slice(0, 20),
			reportUrl,
			runUrl,
		}

		fs.mkdirSync(path.dirname(outputFile), { recursive: true })
		fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`)
	}
}

export default HealthJsonReporter
