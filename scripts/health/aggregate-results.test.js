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

test('manifest defines the 17 required checks with unique IDs', () => {
	assert.equal(manifest.checks.length, 17)
	assert.equal(new Set(manifest.checks.map(check => check.id)).size, 17)
})

test('aggregate passes only when every expected check reports passed', () => {
	const directory = createDirectory()
	manifest.checks.forEach(check => writeCheck(directory, check))
	const summary = aggregate(directory)
	assert.equal(summary.status, 'passed')
	assert.equal(summary.totals.passed, 17)
	assert.match(toMarkdown(summary), /17\/17 passed/)
	assert.match(toSlack(summary).blocks[0].text.text, /17\/17 passed/)
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

test('Slack uses compact two-column health matrices without individual failure names', () => {
	const directory = createDirectory()
	const failedIds = new Set([
		'list-dev-ca',
		'list-dev-mi',
		'list-dev-co',
		'list-dev-nj',
		'live-dev-storefront',
		'live-stage-storefront',
		'live-prod-storefront',
		'concierge-dev',
	])
	manifest.checks.forEach(check => writeCheck(directory, check, failedIds.has(check.id) ? 'failed' : 'passed'))
	const summary = aggregate(directory)
	summary.runUrl = 'https://github.com/710labs/seventen-functional-tests/actions/runs/123'
	const payload = toSlack(summary)
	const serialized = JSON.stringify(payload)
	const listMatrix = payload.blocks.find(block => block.fields?.[0]?.text.includes('LIST · DEV'))
	const liveMatrix = payload.blocks.find(block => block.fields?.[0]?.text.includes('LIVE · DEV'))
	const liveMatrixIndex = payload.blocks.indexOf(liveMatrix)
	const miscAppsIndex = payload.blocks.findIndex(block => block.text?.text.includes('MISC. CUSTOMER APPS'))
	const actions = payload.blocks.find(block => block.type === 'actions')

	assert.equal(listMatrix.fields.length, 2)
	assert.match(listMatrix.fields[0].text, /CA  ❌/)
	assert.match(listMatrix.fields[1].text, /CA  ✅/)
	assert.equal(liveMatrix.fields.length, 3)
	assert.match(liveMatrix.fields[0].text, /Storefront  ❌/)
	assert.match(liveMatrix.fields[0].text, /POS verification  ✅/)
	assert.equal(payload.blocks[liveMatrixIndex + 1].type, 'divider')
	assert.equal(miscAppsIndex, liveMatrixIndex + 2)
	assert.match(payload.blocks[miscAppsIndex].text.text, /Concierge Dev  ❌/)
	assert.doesNotMatch(serialized, /Synthetic failed/)
	assert.doesNotMatch(serialized, /details/)
	assert.equal(actions.elements[0].text.text, 'Open GitHub Action')
	assert.equal(actions.elements[0].url, summary.runUrl)
	assert.equal(actions.elements[1].text.text, 'Open First Failed Report')
})
