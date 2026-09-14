const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const test = require('node:test')

const {
	requireFreshCapture,
	safePageUrl,
} = require('./verify-acuity-storage-state')

test('redacts authentication parameters from verification errors', () => {
	const safeUrl = safePageUrl(
		'https://login.squarespace.com/login?email=user%40example.com&state=secret&code=secret',
	)

	assert.doesNotMatch(safeUrl, /user%40example\.com|state=secret|code=secret/)
	assert.match(safeUrl, /email=redacted/)
})

test('rejects a manual auth file that was not freshly captured', t => {
	fs.mkdirSync(path.join(process.cwd(), '.auth'), { recursive: true })
	const fixtureDir = fs.mkdtempSync(path.join(process.cwd(), '.auth', 'verify-state-test-'))
	t.after(() => fs.rmSync(fixtureDir, { recursive: true, force: true }))
	const fixturePath = path.join(fixtureDir, 'storage-state.json')
	fs.writeFileSync(fixturePath, '{}')

	assert.throws(
		() => requireFreshCapture(path.relative(process.cwd(), fixturePath), 1000, Date.now() + 2000),
		/was not refreshed by this login run/,
	)
})
