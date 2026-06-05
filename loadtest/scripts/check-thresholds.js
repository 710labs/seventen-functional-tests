const fs = require('fs')

function parseArgs(argv) {
	const args = {
		_: [],
		threshold: [],
	}

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index]

		if (!token.startsWith('--')) {
			args._.push(token)
			continue
		}

		const withoutPrefix = token.slice(2)
		const equalsIndex = withoutPrefix.indexOf('=')
		const key = equalsIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, equalsIndex)
		let value = equalsIndex === -1 ? undefined : withoutPrefix.slice(equalsIndex + 1)

		if (value === undefined) {
			const next = argv[index + 1]

			if (next && !next.startsWith('--')) {
				value = next
				index += 1
			} else {
				value = true
			}
		}

		if (key === 'threshold') {
			args.threshold.push(value)
		} else {
			args[key] = value
		}
	}

	return args
}

function parseBoolean(value, fallback = false) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	if (typeof value === 'boolean') {
		return value
	}

	return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase())
}

function parseNumber(value, label) {
	const parsed = Number(value)

	if (!Number.isFinite(parsed)) {
		throw new Error(`${label} must be a number.`)
	}

	return parsed
}

function readReport(reportPath) {
	return JSON.parse(fs.readFileSync(reportPath, 'utf8'))
}

function aggregate(report) {
	if (report && report.aggregate && typeof report.aggregate === 'object') {
		return report.aggregate
	}

	return {}
}

function sumErrorCounters(counters) {
	return Object.entries(counters || {})
		.filter(([name, value]) => name.startsWith('errors.') && typeof value === 'number')
		.reduce((total, [, value]) => total + value, 0)
}

function findSummaryMetric(aggregateReport, metricName) {
	const summaries = aggregateReport.summaries || {}
	const histograms = aggregateReport.histograms || {}
	const lastDotIndex = metricName.lastIndexOf('.')

	if (lastDotIndex === -1) {
		return undefined
	}

	const baseMetric = metricName.slice(0, lastDotIndex)
	const statistic = metricName.slice(lastDotIndex + 1)
	const summary = summaries[baseMetric] || histograms[baseMetric]

	if (!summary || typeof summary !== 'object') {
		return undefined
	}

	return summary[statistic]
}

function getMetricValue(report, metricName) {
	const reportAggregate = aggregate(report)
	const counters = reportAggregate.counters || {}
	const rates = reportAggregate.rates || {}

	if (metricName === 'errors.count') {
		return sumErrorCounters(counters)
	}

	if (metricName === 'errors.rate') {
		const errors = sumErrorCounters(counters)
		const completed = counters['vusers.completed'] || 0
		const failed = counters['vusers.failed'] || 0
		const denominator = completed + failed

		return denominator === 0 ? 0 : errors / denominator
	}

	if (Object.prototype.hasOwnProperty.call(counters, metricName)) {
		return counters[metricName]
	}

	if (Object.prototype.hasOwnProperty.call(rates, metricName)) {
		return rates[metricName]
	}

	const summaryValue = findSummaryMetric(reportAggregate, metricName)

	if (summaryValue !== undefined) {
		return summaryValue
	}

	return undefined
}

function parseThresholdExpression(expression) {
	const match = String(expression).match(/^([^<>=!]+)\s*(<=|>=|<|>|=)\s*(-?\d+(?:\.\d+)?)$/)

	if (!match) {
		throw new Error(`Invalid threshold expression: ${expression}`)
	}

	return {
		metric: match[1].trim(),
		operator: match[2],
		value: Number(match[3]),
		source: String(expression),
	}
}

function thresholdsFromJson(rawValue) {
	if (!rawValue) {
		return []
	}

	const parsed = JSON.parse(rawValue)

	if (Array.isArray(parsed)) {
		return parsed.map(item => {
			if (typeof item === 'string') {
				return parseThresholdExpression(item)
			}

			if (!item || typeof item !== 'object') {
				throw new Error('Threshold JSON array entries must be objects or expressions.')
			}

			return normalizeThresholdObject(item)
		})
	}

	if (!parsed || typeof parsed !== 'object') {
		throw new Error('Threshold JSON must be an array or object.')
	}

	const thresholds = []

	for (const [metric, rule] of Object.entries(parsed)) {
		if (typeof rule === 'number') {
			thresholds.push({
				metric,
				operator: '<=',
				value: rule,
				source: `${metric}<=${rule}`,
			})
			continue
		}

		if (!rule || typeof rule !== 'object') {
			throw new Error(`Threshold rule for ${metric} must be a number or object.`)
		}

		for (const [key, operator] of [
			['max', '<='],
			['min', '>='],
			['lt', '<'],
			['lte', '<='],
			['gt', '>'],
			['gte', '>='],
			['equals', '='],
		]) {
			if (rule[key] !== undefined) {
				thresholds.push({
					metric,
					operator,
					value: parseNumber(rule[key], `${metric}.${key}`),
					source: `${metric}${operator}${rule[key]}`,
				})
			}
		}
	}

	return thresholds
}

function normalizeThresholdObject(item) {
	if (item.metric && item.operator && item.value !== undefined) {
		return {
			metric: item.metric,
			operator: item.operator,
			value: parseNumber(item.value, `${item.metric}.value`),
			source: `${item.metric}${item.operator}${item.value}`,
		}
	}

	if (item.metric && item.max !== undefined) {
		return {
			metric: item.metric,
			operator: '<=',
			value: parseNumber(item.max, `${item.metric}.max`),
			source: `${item.metric}<=${item.max}`,
		}
	}

	if (item.metric && item.min !== undefined) {
		return {
			metric: item.metric,
			operator: '>=',
			value: parseNumber(item.min, `${item.metric}.min`),
			source: `${item.metric}>=${item.min}`,
		}
	}

	throw new Error(`Invalid threshold object: ${JSON.stringify(item)}`)
}

function thresholdsFromArgs(args) {
	const thresholds = args.threshold.map(parseThresholdExpression)

	if (args['max-vusers-failed'] !== undefined) {
		thresholds.push({
			metric: 'vusers.failed',
			operator: '<=',
			value: parseNumber(args['max-vusers-failed'], 'max-vusers-failed'),
			source: `vusers.failed<=${args['max-vusers-failed']}`,
		})
	}

	if (args['min-vusers-completed'] !== undefined) {
		thresholds.push({
			metric: 'vusers.completed',
			operator: '>=',
			value: parseNumber(args['min-vusers-completed'], 'min-vusers-completed'),
			source: `vusers.completed>=${args['min-vusers-completed']}`,
		})
	}

	if (args['max-error-count'] !== undefined) {
		thresholds.push({
			metric: 'errors.count',
			operator: '<=',
			value: parseNumber(args['max-error-count'], 'max-error-count'),
			source: `errors.count<=${args['max-error-count']}`,
		})
	}

	if (args['max-error-rate'] !== undefined) {
		thresholds.push({
			metric: 'errors.rate',
			operator: '<=',
			value: parseNumber(args['max-error-rate'], 'max-error-rate'),
			source: `errors.rate<=${args['max-error-rate']}`,
		})
	}

	if (args['max-session-p95-ms'] !== undefined) {
		thresholds.push({
			metric: 'vusers.session_length.p95',
			operator: '<=',
			value: parseNumber(args['max-session-p95-ms'], 'max-session-p95-ms'),
			source: `vusers.session_length.p95<=${args['max-session-p95-ms']}`,
		})
	}

	return thresholds
}

function buildThresholds(args) {
	return [
		...thresholdsFromJson(process.env.LOADTEST_THRESHOLDS_JSON || process.env.ARTILLERY_THRESHOLDS_JSON),
		...thresholdsFromArgs(args),
	]
}

function evaluateThreshold(value, threshold) {
	switch (threshold.operator) {
		case '<=':
			return value <= threshold.value
		case '>=':
			return value >= threshold.value
		case '<':
			return value < threshold.value
		case '>':
			return value > threshold.value
		case '=':
			return value === threshold.value
		default:
			throw new Error(`Unsupported threshold operator: ${threshold.operator}`)
	}
}

function checkThresholds(report, thresholds) {
	return thresholds.map(threshold => {
		const actual = getMetricValue(report, threshold.metric)
		const passed = actual !== undefined && evaluateThreshold(actual, threshold)

		return {
			...threshold,
			actual,
			passed,
		}
	})
}

function printResults(results) {
	for (const result of results) {
		const actual = result.actual === undefined ? 'missing' : result.actual
		const status = result.passed ? 'ok' : 'fail'

		console.log(
			`[${status}] ${result.metric} actual=${actual} expected ${result.operator} ${result.value}`,
		)
	}
}

function printUsage() {
	console.log(`Usage: node scripts/check-thresholds.js --report <report.json> [options]

Options:
  --threshold "metric<=value"       Add a threshold expression. Repeatable.
  --max-vusers-failed <n>           Shortcut for vusers.failed <= n.
  --min-vusers-completed <n>        Shortcut for vusers.completed >= n.
  --max-error-count <n>             Shortcut for errors.count <= n.
  --max-error-rate <n>              Shortcut for errors.rate <= n.
  --max-session-p95-ms <n>          Shortcut for vusers.session_length.p95 <= n.
  --optional                        Skip when report path is missing.

LOADTEST_THRESHOLDS_JSON may also provide threshold rules.`)
}

function main(argv = process.argv.slice(2)) {
	const args = parseArgs(argv)

	if (args.help) {
		printUsage()
		return []
	}

	if (parseBoolean(process.env.LOADTEST_CHECK_THRESHOLDS_DISABLED)) {
		console.log('Threshold checks disabled.')
		return []
	}

	const thresholds = buildThresholds(args)
	const reportPath = args.report || args._[0] || process.env.ARTILLERY_REPORT_JSON
	const optional =
		parseBoolean(args.optional) || parseBoolean(process.env.LOADTEST_THRESHOLDS_OPTIONAL)

	if (thresholds.length === 0) {
		console.log('No thresholds configured; skipping.')
		return []
	}

	if (!reportPath) {
		if (optional) {
			console.log('No report path provided; threshold checks skipped.')
			return []
		}

		throw new Error('No report path provided.')
	}

	if (!fs.existsSync(reportPath)) {
		if (optional) {
			console.log(`Report not found; threshold checks skipped: ${reportPath}`)
			return []
		}

		throw new Error(`Report not found: ${reportPath}`)
	}

	const report = readReport(reportPath)
	const results = checkThresholds(report, thresholds)
	const failures = results.filter(result => !result.passed)

	printResults(results)

	if (failures.length > 0) {
		throw new Error(`${failures.length} threshold(s) failed.`)
	}

	console.log(`Checked ${results.length} threshold(s).`)

	return results
}

if (require.main === module) {
	try {
		main()
	} catch (error) {
		console.error(`[check-thresholds] ${error.message}`)
		process.exitCode = 1
	}
}

module.exports = {
	buildThresholds,
	checkThresholds,
	getMetricValue,
	parseThresholdExpression,
}
