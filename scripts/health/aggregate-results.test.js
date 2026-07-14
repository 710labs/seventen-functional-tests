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
	assert.match(JSON.stringify(toSlack(summary)), /Failures and warnings/)
})

test('aggregate rejects an invalid status rather than treating it as healthy', () => {
	const directory = createDirectory()
	manifest.checks.forEach((check, index) => writeCheck(directory, check, index === 0 ? 'banana' : 'passed'))
	const summary = aggregate(directory)
	assert.equal(summary.status, 'failed')
	assert.equal(summary.results[0].status, 'unknown')
})
