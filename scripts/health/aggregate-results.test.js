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

test('aggregate keeps flaky distinct from failed', () => {
	const directory = createDirectory()
	manifest.checks.forEach((check, index) => writeCheck(directory, check, index === 0 ? 'flaky' : 'passed'))
	const summary = aggregate(directory)
	assert.equal(summary.status, 'flaky')
	assert.equal(summary.totals.flaky, 1)
	assert.doesNotMatch(JSON.stringify(toSlack(summary)), /Failures and warnings/)
})

test('aggregate rejects an invalid status rather than treating it as healthy', () => {
	const directory = createDirectory()
	manifest.checks.forEach((check, index) => writeCheck(directory, check, index === 0 ? 'banana' : 'passed'))
	const summary = aggregate(directory)
	assert.equal(summary.status, 'failed')
	assert.equal(summary.results[0].status, 'unknown')
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
	assert.match(liveTable, /\| Prod\s+\| ❌\s+\| ❓\s+\| ❓\s+\|/)
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
