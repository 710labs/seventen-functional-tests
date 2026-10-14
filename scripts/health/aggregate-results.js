#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { manifest, runUrl } = require('./result-utils')

const failureStatuses = new Set(['failed', 'missing', 'cancelled', 'blocked', 'unknown'])
const validStatuses = new Set(['passed', 'warning', ...failureStatuses])
const emoji = {
	warning: '🟠',
	skipped: '—',
	passed: '✅',
	failed: '❌',
	missing: '❓',
	cancelled: '⛔',
	blocked: '🚫',
	unknown: '❓',
}

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

function aggregate(directory, onlyGroup = process.env.HEALTH_ONLY_GROUP || '') {
	const checks = manifest.checks.filter(check => !onlyGroup || check.group === onlyGroup)
	if (onlyGroup && !checks.length) throw new Error(`Unknown health group: ${onlyGroup}`)
	const actual = loadResults(directory)
	const results = checks.map(check => {
		const rawResult = actual.get(check.id)
		const result =
			rawResult?.status === 'flaky'
				? {
						...rawResult,
						status: 'passed',
						counts: rawResult.counts
							? {
									...rawResult.counts,
									passed: (rawResult.counts.passed || 0) + (rawResult.counts.flaky || 0),
									flaky: 0,
								}
							: rawResult.counts,
						failureSummary: [],
					}
				: rawResult
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
	const status = hasFailure ? 'failed' : totals.warning ? 'warning' : 'passed'
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

function totalsLine(summary) {
	const warning = summary.totals.warning || 0
	const failed = summary.totals.expected - (summary.totals.passed || 0) - warning
	return `${failed} failed/missing${warning ? ` · ${warning} warning(s)` : ''}`
}

const titleEmojiFor = status => (status === 'passed' ? '🟢' : status === 'warning' ? '🟠' : '🔴')
const seoStatus = (result, lane) => emoji[result.seo?.[lane] || result.status] || '❓'

function toMarkdown(summary) {
	const passed = summary.totals.passed || 0
	const lines = [
		`# ${titleEmojiFor(summary.status)} Daily System Health`,
		'',
		`**${passed}/${summary.totals.expected} passed** · ${totalsLine(summary)}`,
		'',
	]
	const functional = summary.results.filter(result => result.group !== 'SEO')
	if (functional.length) lines.push('| Status | Check | Result |', '|---|---|---|')
	for (const result of functional) {
		const detail =
			result.failureSummary?.[0] ||
			(result.counts ? `${result.counts.passed} tests passed` : result.status)
		const url = result.reportUrl || result.runUrl
		const renderedDetail = url ? `[${markdownCell(detail)}](${url})` : markdownCell(detail)
		lines.push(
			`| ${emoji[result.status] || '❓'} | ${markdownCell(result.label)} | ${renderedDetail} |`,
		)
	}
	const seo = summary.results.filter(result => result.group === 'SEO')
	if (seo.length) {
		lines.push(
			'',
			'## SEO',
			'',
			'| Status | Environment | Technical | Lighthouse | Search Console |',
			'|---|---|---|---|---|',
		)
		for (const result of seo)
			lines.push(
				`| ${emoji[result.status] || '❓'} | ${markdownCell(result.label)} | ${seoStatus(result, 'technical')} | ${seoStatus(result, 'lighthouse')} | ${seoStatus(result, 'rankings')} |`,
			)
		lines.push(
			'',
			'_— means Search Console skipped; see the environment findings for the reason._',
			'',
		)
		for (const result of seo) {
			lines.push(
				'<details>',
				`<summary>${markdownCell(result.label)} findings</summary>`,
				'',
				result.seoMarkdown || result.failureSummary?.join('\n') || result.status,
				'',
				'</details>',
				'',
			)
		}
	}
	return `${lines.join('\n')}\n`
}

function toSlack(summary) {
	const passed = summary.totals.passed || 0
	const titleEmoji = titleEmojiFor(summary.status)
	const resultsById = new Map(summary.results.map(result => [result.id, result]))
	const checks = manifest.checks.filter(check => resultsById.has(check.id))
	const status = check => emoji[resultsById.get(check.id)?.status] || '❓'
	const formatMarkdownTable = (headers, rows) => {
		const allRows = [headers, ...rows].map(row => row.map(value => String(value)))
		const [headerRow, ...bodyRows] = allRows
		const widths = headers.map((_, index) => Math.max(...allRows.map(row => row[index].length)))
		const formatRow = row =>
			`| ${row.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`
		return ['```', formatRow(headerRow), ...bodyRows.map(formatRow), '```'].join('\n')
	}
	const listChecks = checks.filter(check => /^List /i.test(check.group) && check.state)
	const listStates = [...new Set(listChecks.map(check => check.state.toUpperCase()))]
	const listEnvironments = [...new Set(listChecks.map(check => check.group.replace(/^List /i, '')))]
	const listRows = listStates.map(state => [
		state,
		...listEnvironments.map(environment => {
			const check = listChecks.find(
				candidate =>
					candidate.state.toUpperCase() === state && candidate.group === `List ${environment}`,
			)
			return check ? status(check) : '—'
		}),
	])
	const liveChecks = checks.filter(check => /^Live \/ /i.test(check.label))
	const liveEnvironments = [...new Set(liveChecks.map(check => check.label.split(' / ')[1]))]
	const liveDimensions = [
		...new Set(liveChecks.map(check => check.label.split(' / ').slice(2).join(' / '))),
	]
	const liveRows = liveEnvironments.map(environment => [
		environment,
		...liveDimensions.map(dimension => {
			const check = liveChecks.find(candidate => {
				const [, candidateEnvironment, ...candidateDimension] = candidate.label.split(' / ')
				return candidateEnvironment === environment && candidateDimension.join(' / ') === dimension
			})
			return check ? status(check) : '—'
		}),
	])
	const conciergeChecks = checks.filter(
		check =>
			!/^List /i.test(check.group) &&
			!/^Live \/ /i.test(check.label) &&
			check.label.includes(' / '),
	)
	const conciergeRows = conciergeChecks.map(check => {
		const [application, environment] = check.label.split(' / ')
		return [application, environment, status(check)]
	})
	const failedWithReport = summary.results.find(
		result => failureStatuses.has(result.status) && result.reportUrl,
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
			text: {
				type: 'plain_text',
				text: `${titleEmoji} Daily System Health — ${passed}/${summary.totals.expected} passed`,
				emoji: true,
			},
		},
		{ type: 'context', elements: [{ type: 'mrkdwn', text: totalsLine(summary) }] },
	]
	const addTable = (heading, headers, rows) => {
		if (!rows.length) return
		blocks.push(
			{ type: 'divider' },
			{ type: 'section', text: { type: 'mrkdwn', text: `*${heading}*` } },
			{ type: 'section', text: { type: 'mrkdwn', text: formatMarkdownTable(headers, rows) } },
		)
	}
	addTable('LIST', ['State', ...listEnvironments], listRows)
	addTable('LIVE', ['Environment', ...liveDimensions], liveRows)
	const seoRows = summary.results
		.filter(result => result.group === 'SEO')
		.map(result => [
			result.label,
			seoStatus(result, 'technical'),
			seoStatus(result, 'lighthouse'),
			seoStatus(result, 'rankings'),
		])
	addTable('SEO', ['Environment', 'Technical', 'Lighthouse', 'Search Console'], seoRows)
	addTable('CONCIERGE STORES', ['Application', 'Environment', 'Status'], conciergeRows)
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
