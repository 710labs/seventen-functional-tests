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
	const field = (title, rows) => ({
		type: 'mrkdwn',
		text: `*${title}*\n${rows.map(([label, id]) => `${label}  ${status(id)}`).join('\n')}`,
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
			fields: [
				field('LIST · DEV', [
					['CA', 'list-dev-ca'],
					['MI', 'list-dev-mi'],
					['CO', 'list-dev-co'],
					['NJ', 'list-dev-nj'],
				]),
				field('LIST · STAGE', [
					['CA', 'list-stage-ca'],
					['MI', 'list-stage-mi'],
					['CO', 'list-stage-co'],
					['NJ', 'list-stage-nj'],
				]),
			],
		},
		{ type: 'divider' },
		{
			type: 'section',
			fields: [
				field('LIVE · DEV', [
					['Storefront', 'live-dev-storefront'],
					['POS verification', 'live-dev-pos'],
				]),
				field('LIVE · STAGE', [
					['Storefront', 'live-stage-storefront'],
					['POS verification', 'live-stage-pos'],
					['POS last 10', 'live-stage-pos-last-10'],
				]),
				field('LIVE · PROD', [['Storefront', 'live-prod-storefront']]),
				field('CUSTOMER APPS', [
					['Concierge Dev', 'concierge-dev'],
					['Concierge Prod', 'concierge-prod'],
					['Employee Prod', 'employee-prod'],
				]),
			],
		},
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
