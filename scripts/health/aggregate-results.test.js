const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { aggregate, toMarkdown, toSlack } = require('./aggregate-results')
const { manifest } = require('./result-utils')

function createDirectory() {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'daily-system-health-'))
}

function writeCheck(directory, check, status = 'passed') {
	fs.writeFileSync(
		path.join(directory, `${check.id}.json`),
		JSON.stringify({
			id: check.id,
			label: check.label,
			group: check.group,
			status,
			counts: { passed: status === 'passed' ? 1 : 0, failed: status === 'failed' ? 1 : 0, flaky: status === 'flaky' ? 1 : 0, skipped: 0 },
			failureSummary: status === 'passed' ? [] : [`Synthetic ${status}`],
			reportUrl: `https://example.com/${check.id}`,
		}),
	)
}

test('manifest defines the 22 required checks with unique IDs', () => {
	assert.equal(manifest.checks.length, 22)
	assert.equal(new Set(manifest.checks.map(check => check.id)).size, 22)
})

test('aggregate passes only when every expected check reports passed', () => {
	const directory = createDirectory()
	manifest.checks.forEach(check => writeCheck(directory, check))
	const summary = aggregate(directory)
	assert.equal(summary.status, 'passed')
	assert.equal(summary.totals.passed, 22)
	assert.match(toMarkdown(summary), /22\/22 passed/)
	assert.match(toSlack(summary).blocks[0].text.text, /22\/22 passed/)
})

test('aggregate treats a missing result as a failure', () => {
	const directory = createDirectory()
	manifest.checks.slice(0, -1).forEach(check => writeCheck(directory, check))
	const summary = aggregate(directory)
	assert.equal(summary.status, 'failed')
	assert.equal(summary.results.at(-1).status, 'missing')
	assert.match(summary.results.at(-1).failureSummary[0], /did not produce/)
})

test('QueueIt is visible as deferred, excluded from failures, and never hides a real failure', () => {
	const directory = createDirectory()
	try {
		manifest.checks.forEach(check => writeCheck(directory, check, check.id.startsWith('list-prod-') ? 'queued' : 'passed'))
		const summary = aggregate(directory)
		assert.equal(summary.status, 'queued')
		assert.equal(summary.totals.queued, 4)
		assert.equal(summary.totals.passed, 18)
		assert.match(toMarkdown(summary), /0 failed\/missing · 4 QueueIt deferred/)
		const slack = JSON.stringify(toSlack(summary))
		assert.match(slack, /⏳ Daily System Health/)
		assert.match(slack, /QueueIt active — checks deferred/)
		assert.match(slack, /CA\s+\| ✅\s+\| ✅\s+\| ⏳/)
		writeCheck(directory, manifest.checks[0], 'failed')
		const mixed = aggregate(directory)
		assert.equal(mixed.status, 'failed')
		assert.match(JSON.stringify(toSlack(mixed)), /1 failed\/missing · 4 QueueIt deferred/)
		fs.unlinkSync(path.join(directory, `${manifest.checks[1].id}.json`))
		assert.equal(aggregate(directory).status, 'failed')
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('aggregate treats a retry-recovered flaky result as passed', () => {
	const directory = createDirectory()
	manifest.checks.forEach((check, index) => writeCheck(directory, check, index === 0 ? 'flaky' : 'passed'))
	const summary = aggregate(directory)
	assert.equal(summary.status, 'passed')
	assert.equal(summary.totals.passed, 22)
	assert.equal(summary.totals.flaky, undefined)
	assert.equal(summary.results[0].status, 'passed')
	assert.equal(summary.results[0].counts.passed, 1)
	assert.equal(summary.results[0].counts.flaky, 0)
	assert.match(toMarkdown(summary), /^# 🟢 Daily System Health/)
	assert.doesNotMatch(toMarkdown(summary), /flaky/i)
	assert.match(toSlack(summary).blocks[0].text.text, /^🟢 Daily System Health/)
	assert.doesNotMatch(JSON.stringify(toSlack(summary)), /flaky/i)
})

test('aggregate rejects an invalid status rather than treating it as healthy', () => {
	const directory = createDirectory()
	manifest.checks.forEach((check, index) => writeCheck(directory, check, index === 0 ? 'banana' : 'passed'))
	const summary = aggregate(directory)
	assert.equal(summary.status, 'failed')
	assert.equal(summary.results[0].status, 'unknown')
})

test('Slack diagnostic summary uses fixed codes and never raw failure text', () => {
	const directory = createDirectory()
	manifest.checks.forEach(check => writeCheck(directory, check))
	const check = manifest.checks.find(check => check.id === 'live-dev-storefront')
	fs.writeFileSync(path.join(directory, `${check.id}.json`), JSON.stringify({
		id: check.id, status: 'failed', failureSummary: ['SECRET_CANARY'],
		diagnostics: [
			{ category: 'google-maps-referrer-denied', phase: 'address-entry', message: 'SECRET_CANARY' },
			{ category: 'SECRET_CANARY', phase: 'SECRET_CANARY' },
		],
	}))
	const body = JSON.stringify(toSlack(aggregate(directory)))
	assert.match(body, /Live \/ Dev \/ Storefront: google-maps-referrer-denied \(address-entry\)/)
	assert.match(body, /test-error \(test\)/)
	assert.doesNotMatch(body, /SECRET_CANARY/)
})

test('Slack lays out linked failures in two-column fields without duplicate report lists', () => {
	const directory = createDirectory()
	try {
		manifest.checks.forEach((check, index) => writeCheck(directory, check, index < 9 ? 'failed' : 'passed'))
		const summary = aggregate(directory)
		const reportUrl = id => `https://test-reports.s3.us-east-1.amazonaws.com/run-123/${id}/index.html`
		summary.results.forEach(result => {
			result.reportUrl = reportUrl(result.id)
			result.hostedReport = { status: 'complete', url: result.reportUrl }
			result.diagnostics = [{ category: 'timeout', phase: 'test' }]
		})
		summary.results[1].diagnostics = []
		delete summary.results[1].hostedReport
		summary.results[2].reportUrl = null
		summary.results[2].hostedReport = { status: 'incomplete', url: 'javascript:alert(1)' }
		const payload = toSlack(summary)
		const sections = payload.blocks.filter(block => block.fields)
		assert.equal(sections.length, 1)
		assert.equal(sections[0].fields.length, 9)
		const fields = sections[0].fields
		assert.equal(fields[0].text, `<${reportUrl(summary.results[0].id)}|${summary.results[0].label}>: timeout (test)`)
		assert.equal(fields[1].text, `<${reportUrl(summary.results[1].id)}|${summary.results[1].label}>: failed`)
		assert.equal(fields[2].text, `${summary.results[2].label}: timeout (test), hosted report upload incomplete`)
		assert.doesNotMatch(JSON.stringify(payload), /Playwright reports|javascript:|Synthetic failed/)
		assert.ok(!JSON.stringify(payload).includes(reportUrl(summary.results[9].id)))

		// Larger failure sets must retain every link and respect Slack's field limit.
		summary.results.forEach(result => { result.status = 'failed' })
		const expanded = toSlack(summary).blocks
		assert.deepEqual(expanded.filter(block => block.fields).map(block => block.fields.length), [10, 10, 2])
		assert.equal(expanded.filter(block => block.text?.text === '*Failure categories*').length, 1)
		summary.results.forEach(result => { result.status = 'passed' })
		assert.equal(toSlack(summary).blocks.filter(block => block.fields).length, 0)
	} finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('Slack uses standard blocks with manifest-driven status tables and no individual failure names', () => {
	const directory = createDirectory()
	const failedIds = new Set([
		'list-dev-ca',
		'list-dev-mi',
		'list-dev-co',
		'list-dev-nj',
		'list-prod-mi',
		'live-dev-storefront',
		'live-dev-pos-last-10',
		'live-stage-storefront',
		'live-prod-storefront',
		'concierge-dev',
	])
	manifest.checks.forEach(check => writeCheck(directory, check, failedIds.has(check.id) ? 'failed' : 'passed'))
	const summary = aggregate(directory)
	summary.runUrl = 'https://github.com/710labs/seventen-functional-tests/actions/runs/123'
	const payload = toSlack(summary)
	const serialized = JSON.stringify(payload)
	const listHeadingIndex = payload.blocks.findIndex(block => block.text?.text === '*LIST*')
	const liveHeadingIndex = payload.blocks.findIndex(block => block.text?.text === '*LIVE*')
	const liveTableIndex = liveHeadingIndex + 1
	const conciergeStoresHeadingIndex = payload.blocks.findIndex(block => block.text?.text.includes('CONCIERGE STORES'))
	const listTable = payload.blocks[listHeadingIndex + 1].text.text
	const liveTable = payload.blocks[liveHeadingIndex + 1].text.text
	const miscAppsTable = payload.blocks[conciergeStoresHeadingIndex + 1].text.text
	const actions = payload.blocks.find(block => block.type === 'actions')

	assert.doesNotMatch(serialized, /"type":"table"/)
	assert.doesNotMatch(serialized, /"raw_text"/)
	assert.match(listTable, /\| State \| Dev \| Stage \| Prod \|/)
	assert.match(listTable, /\| CA\s+\| ❌\s+\| ✅\s+\| ✅\s+\|/)
	assert.match(listTable, /\| MI\s+\| ❌\s+\| ✅\s+\| ❌\s+\|/)
	assert.match(liveTable, /\| Environment \| Storefront \| POS Verification \| POS Last 10 Orders \|/)
	assert.match(liveTable, /\| Dev\s+\| ❌\s+\| ✅\s+\| ❌\s+\|/)
	assert.match(liveTable, /\| Stage\s+\| ❌\s+\| ✅\s+\| ✅\s+\|/)
	assert.match(liveTable, /\| Prod\s+\| ❌\s+\| —\s+\| —\s+\|/)
	assert.equal(payload.blocks[liveHeadingIndex + 1].type, 'section')
	assert.equal(conciergeStoresHeadingIndex, liveTableIndex + 2)
	assert.match(miscAppsTable, /\| Application \| Environment \| Status \|/)
	assert.match(miscAppsTable, /\| Concierge\s+\| Dev\s+\| ❌\s+\|/)
	assert.match(miscAppsTable, /\| Concierge\s+\| Prod\s+\| ✅\s+\|/)
	assert.match(miscAppsTable, /\| Employee\s+\| Prod\s+\| ✅\s+\|/)
	assert.doesNotMatch(serialized, /Synthetic failed/)
	assert.doesNotMatch(serialized, /details/)
	assert.equal(actions.elements[0].text.text, 'Open GitHub Action')
	assert.equal(actions.elements[0].url, summary.runUrl)
	assert.equal(actions.elements[1].text.text, 'Open First Failed Report')
})
