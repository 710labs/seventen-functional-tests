#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { sanitizeSummary } = require('./security/summary')

async function main() {
	if (!process.env.SLACK_WEBHOOK_URL) return
	const directory = path.resolve('public-results')
	const summaries = fs.existsSync(directory)
		? fs.readdirSync(directory).filter(file => /^admin-drop-\d+\.json$/.test(file))
			.map(file => sanitizeSummary(JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'))))
		: []
	const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 }
	for (const summary of summaries) for (const key of Object.keys(counts)) counts[key] += summary.counts[key]
	const failed = process.env.ADMIN_DROP_TEST_OUTCOME !== 'success' || !summaries.length || summaries.some(s => s.status !== 'passed')
	const recordingLinks = summaries.flatMap((summary, index) => summary.hostedReport?.url
		? [`<${summary.hostedReport.url}|Phase ${index + 1} Playwright report>`] : [])
	const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text: `Admin Drop: ${failed ? 'Failed' : 'Passed'}\n${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} flaky, ${counts.skipped} skipped across ${summaries.length} phases.${recordingLinks.length ? '\n' + recordingLinks.join('\n') : ''}` }),
	})
	if (!response.ok) throw new Error('Notification failed')
}
main().catch(() => { console.error('Admin Drop summary notification failed'); process.exitCode = 1 })
