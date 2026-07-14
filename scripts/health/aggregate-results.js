#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { manifest, runUrl } = require('./result-utils')

const failureStatuses = new Set(['failed', 'missing', 'cancelled', 'blocked', 'unknown'])
const validStatuses = new Set(['passed', 'flaky', ...failureStatuses])
const emoji = { passed: '✅', flaky: '⚠️', failed: '❌', missing: '❓', cancelled: '⛔', blocked: '🚫', unknown: '❓' }

function walkJson(directory) {
	if (!fs.existsSync(directory)) return []
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		const fullPath = path.join(directory, entry.name)
		return entry.isDirectory() ? walkJson(fullPath) : entry.name.endsWith('.json') ? [fullPath] : []
	})
}

function loadResults(directory) {
	const results = new Map()
	for (const file of walkJson(directory)) {
		try {
			const result = JSON.parse(fs.readFileSync(file, 'utf8'))
			if (result.id) results.set(result.id, result)
		} catch (error) {
			console.warn(`Ignoring invalid result file ${file}: ${error.message}`)
		}
	}
	return results
}

function aggregate(directory) {
	const actual = loadResults(directory)
	const results = manifest.checks.map(check => {
		const result = actual.get(check.id)
		return result && validStatuses.has(result.status)
			? { ...result, id: check.id, label: check.label, group: check.group }
			: result
				? {
						...result,
						id: check.id,
						label: check.label,
						group: check.group,
						status: 'unknown',
						failureSummary: [`The check produced an invalid status: ${String(result.status)}`],
					}
			: {
					schemaVersion: 1,
					id: check.id,
					label: check.label,
					group: check.group,
					status: 'missing',
					failureSummary: ['The check did not produce a result artifact.'],
					runUrl: runUrl(),
				}
	})
	const totals = results.reduce(
		(accumulator, result) => {
			accumulator[result.status] = (accumulator[result.status] || 0) + 1
			return accumulator
		},
		{ expected: results.length },
	)
	const hasFailure = results.some(result => failureStatuses.has(result.status))
	const hasFlaky = results.some(result => result.status === 'flaky')
	const status = hasFailure ? 'failed' : hasFlaky ? 'flaky' : 'passed'
	return {
		schemaVersion: 1,
		status,
		generatedAt: new Date().toISOString(),
		runUrl: runUrl(),
		totals,
		results,
	}
}

function markdownCell(value) {
	return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function toMarkdown(summary) {
	const passed = summary.totals.passed || 0
	const flaky = summary.totals.flaky || 0
	const failed = summary.totals.expected - passed - flaky
	const titleEmoji = summary.status === 'passed' ? '🟢' : summary.status === 'flaky' ? '🟡' : '🔴'
	const lines = [
		`# ${titleEmoji} Daily System Health`,
		'',
		`**${passed}/${summary.totals.expected} passed** · ${failed} failed/missing · ${flaky} flaky`,
		'',
		'| Status | Check | Result |',
		'|---|---|---|',
	]
	for (const result of summary.results) {
		const detail = result.failureSummary?.[0] || (result.counts ? `${result.counts.passed} tests passed` : result.status)
		const url = result.reportUrl || result.runUrl
		const renderedDetail = url ? `[${markdownCell(detail)}](${url})` : markdownCell(detail)
		lines.push(`| ${emoji[result.status] || '❓'} | ${markdownCell(result.label)} | ${renderedDetail} |`)
	}
	return `${lines.join('\n')}\n`
}

function toSlack(summary) {
	const passed = summary.totals.passed || 0
	const flaky = summary.totals.flaky || 0
	const failed = summary.totals.expected - passed - flaky
	const titleEmoji = summary.status === 'passed' ? '🟢' : summary.status === 'flaky' ? '🟡' : '🔴'
	const resultsById = new Map(summary.results.map(result => [result.id, result]))
	const status = id => emoji[resultsById.get(id)?.status] || '❓'
	const tableCell = text => ({ type: 'raw_text', text: String(text) })
	const table = (headers, rows) => ({
		type: 'table',
		column_settings: headers.map((_, index) => ({ align: index === 0 ? 'left' : 'center' })),
		rows: [headers, ...rows].map(row => row.map(tableCell)),
	})
	const failedWithReport = summary.results.find(
		result => (failureStatuses.has(result.status) || result.status === 'flaky') && result.reportUrl,
	)
	const actions = []
	if (summary.runUrl) {
		actions.push({
			type: 'button',
			text: { type: 'plain_text', text: 'Open GitHub Action', emoji: true },
			style: 'primary',
			url: summary.runUrl,
		})
	}
	if (failedWithReport) {
		actions.push({
			type: 'button',
			text: { type: 'plain_text', text: 'Open First Failed Report', emoji: true },
			url: failedWithReport.reportUrl,
		})
	}

	const blocks = [
		{
			type: 'header',
			text: { type: 'plain_text', text: `${titleEmoji} Daily System Health — ${passed}/${summary.totals.expected} passed`, emoji: true },
		},
		{
			type: 'context',
			elements: [{ type: 'mrkdwn', text: `${failed} failed/missing · ${flaky} flaky` }],
		},
		{ type: 'divider' },
		{
			type: 'section',
			text: { type: 'mrkdwn', text: '*LIST*' },
		},
		table(
			['State', 'Dev', 'Stage'],
			[
				['CA', status('list-dev-ca'), status('list-stage-ca')],
				['MI', status('list-dev-mi'), status('list-stage-mi')],
				['CO', status('list-dev-co'), status('list-stage-co')],
				['NJ', status('list-dev-nj'), status('list-stage-nj')],
			],
		),
		{ type: 'divider' },
		{
			type: 'section',
			text: { type: 'mrkdwn', text: '*LIVE*' },
		},
		table(
			['Environment', 'Storefront', 'POS verification', 'POS last 10'],
			[
				['Dev', status('live-dev-storefront'), status('live-dev-pos'), status('live-dev-pos-last-10')],
				['Stage', status('live-stage-storefront'), status('live-stage-pos'), status('live-stage-pos-last-10')],
				['Prod', status('live-prod-storefront'), '—', '⏭️ need to build check'],
			],
		),
		{ type: 'divider' },
		{
			type: 'section',
			text: { type: 'mrkdwn', text: '*CONCIERGE STORES*' },
		},
		table(
			['Application', 'Environment', 'Status'],
			[
				['Concierge', 'Dev', status('concierge-dev')],
				['Concierge', 'Prod', status('concierge-prod')],
				['Employee', 'Prod', status('employee-prod')],
			],
		),
	]
	if (actions.length) blocks.push({ type: 'divider' }, { type: 'actions', elements: actions })
	return { blocks }
}

function main() {
	const directory = process.argv[2] || 'health-results'
	const summaryFile = process.argv[3] || 'health-summary.json'
	const markdownFile = process.argv[4] || 'health-summary.md'
	const slackFile = process.argv[5] || 'health-slack.json'
	const summary = aggregate(directory)
	fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`)
	fs.writeFileSync(markdownFile, toMarkdown(summary))
	fs.writeFileSync(slackFile, `${JSON.stringify(toSlack(summary), null, 2)}\n`)
	console.log(`Aggregated ${summary.results.length} checks: ${summary.status}`)
}

if (require.main === module) main()

module.exports = { aggregate, loadResults, toMarkdown, toSlack }
