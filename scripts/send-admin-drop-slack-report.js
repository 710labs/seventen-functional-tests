#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const defaultResultsPath = path.resolve('test-results/admin-drop-results.json')
const resultsPath = path.resolve(process.env.ADMIN_DROP_RESULTS_PATH || defaultResultsPath)
const maxFailureCount = 20
const maxFailureTextLength = 2400

const fetchFn =
	typeof globalThis.fetch === 'function'
		? globalThis.fetch.bind(globalThis)
		: async (...args) => {
				const { default: nodeFetch } = await import('node-fetch')
				return nodeFetch(...args)
			}

function asNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatDuration(ms) {
	if (!Number.isFinite(ms) || ms <= 0) {
		return 'Unavailable'
	}

	const seconds = Math.round(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const remainder = seconds % 60

	return minutes === 0 ? `${remainder}s` : `${minutes}m ${remainder}s`
}

function readJsonReport(filePath) {
	if (!fs.existsSync(filePath)) {
		return null
	}

	return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function collectProblemTestsFromSuite(suite, problems = []) {
	for (const spec of suite.specs || []) {
		for (const test of spec.tests || []) {
			if (test.status === 'unexpected' || test.status === 'flaky') {
				const projectName = test.projectName ? ` [${test.projectName}]` : ''
				problems.push(`${spec.title}${projectName}`)
			}
		}
	}

	for (const childSuite of suite.suites || []) {
		collectProblemTestsFromSuite(childSuite, problems)
	}

	return problems
}

function summarizeReport(report) {
	if (!report || typeof report !== 'object') {
		return null
	}

	const stats = report.stats || {}
	const passed = asNumber(stats.expected)
	const failed = asNumber(stats.unexpected)
	const flaky = asNumber(stats.flaky)
	const skipped = asNumber(stats.skipped)
	const total = passed + failed + flaky + skipped
	const problemTests = []

	for (const suite of report.suites || []) {
		collectProblemTestsFromSuite(suite, problemTests)
	}

	return {
		duration: asNumber(stats.duration),
		failed,
		flaky,
		passed,
		problemTests: Array.from(new Set(problemTests)).slice(0, maxFailureCount),
		skipped,
		total,
	}
}

function getStatus(summary, testOutcome) {
	if (summary) {
		if (summary.failed > 0) {
			return { emoji: ':red_circle:', text: 'Failed' }
		}

		if (summary.flaky > 0) {
			return { emoji: ':large_yellow_circle:', text: 'Flaky' }
		}

		return { emoji: ':large_green_circle:', text: 'Passed' }
	}

	if (testOutcome && testOutcome !== 'success') {
		return { emoji: ':red_circle:', text: 'Failed' }
	}

	return { emoji: ':large_green_circle:', text: 'Passed' }
}

function buildS3ReportUrl() {
	const { ENV_ID, RUN_ID, S3_BUCKET, S3_REGION, UNIQUE_RUN_ID } = process.env

	if (!ENV_ID || !RUN_ID || !S3_BUCKET || !S3_REGION || !UNIQUE_RUN_ID) {
		return null
	}

	return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${ENV_ID}-${UNIQUE_RUN_ID}-${RUN_ID}/index.html`
}

function buildGithubRunUrl() {
	const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com'
	const repository = process.env.GITHUB_REPOSITORY || '710labs/seventen-functional-tests'
	const runId = process.env.UNIQUE_RUN_ID || process.env.GITHUB_RUN_ID

	return runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null
}

function buildCountsText(summary) {
	if (!summary) {
		return 'Report stats unavailable.'
	}

	return [
		`${summary.passed} (Passed)`,
		`${summary.failed} (Failed)`,
		summary.flaky > 0 ? `${summary.flaky} (Flaky)` : null,
		summary.skipped > 0 ? `${summary.skipped} (Skipped)` : null,
		`${summary.total} (Total)`,
		`Duration: ${formatDuration(summary.duration)}`,
	]
		.filter(Boolean)
		.join('\n')
}

function buildProblemText(summary) {
	if (!summary || summary.problemTests.length === 0) {
		return ''
	}

	const problemText = summary.problemTests.map(test => `- ${test}`).join('\n')
	const suffix =
		problemText.length > maxFailureTextLength
			? `${problemText.slice(0, maxFailureTextLength)}...`
			: problemText

	return `\n\nFailures or Flaky:\n${suffix}`
}

function buildPayload(summary) {
	const status = getStatus(summary, process.env.ADMIN_DROP_TEST_OUTCOME)
	const reportUrl = buildS3ReportUrl()
	const githubUrl = buildGithubRunUrl()
	const runId = [process.env.UNIQUE_RUN_ID, process.env.RUN_ID].filter(Boolean).join('-')
	const actionElements = []

	if (reportUrl) {
		actionElements.push({
			type: 'button',
			text: {
				type: 'plain_text',
				emoji: false,
				text: 'Test Report',
			},
			style: 'primary',
			url: reportUrl,
		})
	}

	if (githubUrl) {
		actionElements.push({
			type: 'button',
			text: {
				type: 'plain_text',
				emoji: false,
				text: 'GitHub Action',
			},
			style: 'primary',
			url: githubUrl,
		})
	}

	const blocks = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: `Admin Drop Smoke Tests - ${status.text}`,
				emoji: true,
			},
		},
		{
			type: 'section',
			fields: [
				{
					type: 'mrkdwn',
					text: `*Environment:*\n${process.env.ENV || 'Unavailable'}`,
				},
				{
					type: 'mrkdwn',
					text: `*Execution Type:*\n${process.env.EXECUTION_TYPE || 'Unavailable'}`,
				},
				{
					type: 'mrkdwn',
					text: `*Test Run ID:*\n${runId || 'Unavailable'}`,
				},
				{
					type: 'mrkdwn',
					text: `*Workflow Result:*\n${process.env.ADMIN_DROP_TEST_OUTCOME || 'Unavailable'}`,
				},
			],
		},
		{
			type: 'divider',
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `${status.emoji} *${status.text}*\n\n${buildCountsText(summary)}${buildProblemText(summary)}`,
			},
		},
	]

	if (actionElements.length > 0) {
		blocks.push(
			{
				type: 'divider',
			},
			{
				type: 'actions',
				elements: actionElements,
			},
		)
	}

	return { blocks }
}

async function sendSlackMessage(payload) {
	if (
		process.env.SLACK_DRY_RUN === 'true' ||
		process.env.ADMIN_DROP_SLACK_DRY_RUN === 'true'
	) {
		console.log(JSON.stringify(payload, null, 2))
		return
	}

	if (!process.env.SLACK_WEBHOOK_URL) {
		console.log('[admin-drop] SLACK_WEBHOOK_URL not set; skipping Slack notification.')
		return
	}

	const response = await fetchFn(process.env.SLACK_WEBHOOK_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	})

	if (response.ok) {
		console.log('[admin-drop] Slack notification sent successfully.')
		return
	}

	const message = `[admin-drop] Slack notification failed: ${response.status} ${response.statusText}`
	console.log(message)
	throw new Error(message)
}

async function main() {
	let report = null

	try {
		report = readJsonReport(resultsPath)
	} catch (error) {
		console.log(`[admin-drop] Failed to parse merged Playwright JSON report: ${resultsPath}`, error)
	}

	const summary = summarizeReport(report)

	if (!summary) {
		console.log(`[admin-drop] Could not read merged Playwright JSON report: ${resultsPath}`)
	}

	await sendSlackMessage(buildPayload(summary))
}

if (require.main === module) {
	main().catch(error => {
		console.log('[admin-drop] Slack notification failed:', error)
		process.exit(1)
	})
}

module.exports = {
	buildPayload,
	collectProblemTestsFromSuite,
	summarizeReport,
}
