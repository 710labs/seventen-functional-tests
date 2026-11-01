const fs = require('node:fs')
const { SCENARIOS, boolean } = require('../flows/live-settings')

function checkLiveReport(report, { scenario = 'rec-order', profile = 'smoke', placeOrders = false } = {}) {
	const counters = report?.aggregate?.counters
	if (!counters) throw new Error('Live report has no aggregate counters')
	const completed = counters['vusers.completed'] || 0
	const failed = counters['vusers.failed'] || 0
	const created = counters['vusers.created'] || 0
	if (!completed || created !== completed + failed) throw new Error('No completed users or incomplete Live report')
	const limit = profile === 'ramp' ? 0.01 : 0
	if (failed / created > limit) throw new Error(`Live failed-user rate exceeds ${limit * 100}%`)
	const selected = scenario === 'mixed' ? SCENARIOS : [scenario]
	if (!selected.every(name => SCENARIOS.includes(name))) throw new Error('Invalid Live report scenario')
	let completedOrders = 0
	for (const name of selected) {
		const done = counters[`live.${name}.completed`] || 0
		if (!done) throw new Error(`No completed ${name} journeys`)
		if (name.endsWith('-order')) completedOrders += done
	}
	if (placeOrders && completedOrders > (counters['live.orders_confirmed'] || 0)) {
		throw new Error('Completed order journeys are missing confirmed orders')
	}
	if (!placeOrders && (counters['live.orders_confirmed'] || 0) !== 0) {
		throw new Error('Orders were submitted when place_orders was false')
	}
	if (profile !== 'ramp' && (created !== 1 || failed !== 0 || (counters['vusers.skipped'] || 0) !== 0)) {
		throw new Error('Smoke must complete exactly one user with no failures or skipped users')
	}
	return { created, completed, failed, skipped: counters['vusers.skipped'] || 0, orders: counters['live.orders_confirmed'] || 0 }
}

function reportSummary(report, result) {
	const summaries = report.aggregate.summaries || report.aggregate.histograms || {}
	const lines = [
		'## Live dev load test', '',
		`Users: ${result.created} created, ${result.completed} completed, ${result.failed} failed, ${result.skipped} skipped.`,
		`Confirmed orders: ${result.orders}.`, '',
		'| Journey step | p95 (ms) |', '|---|---:|',
	]
	for (const [name, value] of Object.entries(summaries)) {
		if (/^live\.[a-z-]+\.[a-z_]+\.ms$/.test(name)) lines.push(`| ${name} | ${value.p95 ?? 'n/a'} |`)
	}
	return lines.join('\n') + '\n'
}

if (require.main === module) {
	try {
		const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
		const result = checkLiveReport(report, {
			scenario: process.env.LIVE_SCENARIO,
			profile: process.env.LIVE_PROFILE,
			placeOrders: boolean(process.env.PLACE_ORDERS),
		})
		const summary = reportSummary(report, result)
		console.log(summary)
		if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
	} catch (error) {
		console.error(error.message)
		process.exitCode = 1
	}
}
module.exports = { checkLiveReport, reportSummary }
