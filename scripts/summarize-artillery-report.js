const fs = require('fs')

const DEFAULT_SUMMARY = 'Artillery stats:\nArtillery summary unavailable'
const MAX_ERRORS = 5

function formatNumber(value) {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 'n/a'
	}

	return new Intl.NumberFormat('en-US', {
		maximumFractionDigits: 1,
	}).format(value)
}

function truncate(value, maxLength = 90) {
	const text = String(value)

	return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text
}

function getAggregate(report) {
	if (report && typeof report.aggregate === 'object' && report.aggregate) {
		return report.aggregate
	}

	return {}
}

function getSessionLengthStats(aggregate) {
	const summaries = aggregate.summaries || {}
	const histograms = aggregate.histograms || {}

	return summaries['vusers.session_length'] || histograms['vusers.session_length'] || null
}

function summarizeReport(report) {
	const aggregate = getAggregate(report)
	const counters = aggregate.counters || {}
	const sessionLength = getSessionLengthStats(aggregate)
	const errors = Object.entries(counters)
		.filter(([name, value]) => name.startsWith('errors.') && typeof value === 'number' && value > 0)
		.sort(([, left], [, right]) => right - left)
		.slice(0, MAX_ERRORS)

	const lines = [
		'Artillery stats:',
		`VUsers: created ${formatNumber(counters['vusers.created'] || 0)} | completed ${formatNumber(counters['vusers.completed'] || 0)} | failed ${formatNumber(counters['vusers.failed'] || 0)}`,
	]

	if (sessionLength) {
		lines.push(
			[
				`Session length ms: min ${formatNumber(sessionLength.min)}`,
				`mean ${formatNumber(sessionLength.mean)}`,
				`median ${formatNumber(sessionLength.median)}`,
				`p95 ${formatNumber(sessionLength.p95)}`,
				`p99 ${formatNumber(sessionLength.p99)}`,
			].join(' | '),
		)
	} else {
		lines.push('Session length ms: unavailable')
	}

	if (errors.length > 0) {
		lines.push('Errors:')
		for (const [name, count] of errors) {
			lines.push(`- ${truncate(name.replace(/^errors\./, ''))}: ${formatNumber(count)}`)
		}
	} else {
		lines.push('Errors: none')
	}

	return lines.join('\n')
}

function writeMultilineEnv(name, value) {
	if (!process.env.GITHUB_ENV) {
		return
	}

	const delimiter = `${name}_${Date.now()}_${Math.random().toString(16).slice(2)}`
	fs.appendFileSync(process.env.GITHUB_ENV, `${name}<<${delimiter}\n${value}\n${delimiter}\n`)
}

function appendStepSummary(value) {
	if (!process.env.GITHUB_STEP_SUMMARY) {
		return
	}

	fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Artillery Stats\n\n\`\`\`\n${value}\n\`\`\`\n`)
}

function loadReport(reportPath) {
	const rawReport = fs.readFileSync(reportPath, 'utf8')

	return JSON.parse(rawReport)
}

function main() {
	const reportPath = process.argv[2] || process.env.ARTILLERY_REPORT_JSON
	let summary = DEFAULT_SUMMARY

	try {
		if (!reportPath) {
			throw new Error('No report path was provided.')
		}

		summary = summarizeReport(loadReport(reportPath))
	} catch (error) {
		console.warn(`[artillery-summary] ${error.message}`)
	}

	console.log(summary)
	writeMultilineEnv('ARTILLERY_SLACK_SUMMARY', summary)
	appendStepSummary(summary)
}

if (require.main === module) {
	main()
}

module.exports = {
	DEFAULT_SUMMARY,
	formatNumber,
	summarizeReport,
}
