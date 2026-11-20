const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { targets, assertStageUrl, selectTargets, transmissionProblem } = require('../../support/live-order-generator/targets.cjs')
const { summarize } = require('./summarize.cjs')

test('rejects production, lookalike hosts, HTTP, and URL credentials', () => {
	assert.doesNotThrow(() => assertStageUrl('https://live-stage.710labs.com/checkout/'))
	for (const url of ['https://live.710labs.com', 'https://live-dev.710labs.com', 'http://live-stage.710labs.com', 'https://live-stage.710labs.com.evil.test', 'https://user:pass@live-stage.710labs.com']) {
		assert.throws(() => assertStageUrl(url))
	}
	assert.throws(() => selectTargets('production'))
})

test('requires the intended POS instance, POS type, and external order ID', () => {
	const target = targets[2]
	const body = { outcome: 'success', instanceID: '15', instanceName: 'partnersandbox3', instanceType: 'Treez (v3)', externalID: 'sandbox-order' }
	assert.equal(transmissionProblem(body, target), null)
	assert.equal(transmissionProblem({ ...body, instanceID: '4' }, target), 'POS instance mismatch')
	assert.equal(transmissionProblem({ ...body, instanceType: 'Blaze' }, target), 'POS type mismatch')
	assert.equal(transmissionProblem({ ...body, externalID: '' }, target), 'Missing POS external order ID')
	assert.notEqual(transmissionProblem({ ...body, outcome: 'pending' }, target), null)
})

test('requires two distinct verified orders for every selected POS and preserves partial creation', t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-generator-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	assert.equal(summarize(directory).status, 'failed')
	let order = 100
	for (const target of targets) {
		for (const sequence of [1, 2]) {
			fs.writeFileSync(path.join(directory, `${target.pos}-${sequence}.json`), JSON.stringify({
				...target, sequence, orderId: String(order++), status: 'verified', externalId: 'external-order',
			}))
		}
	}
	assert.equal(summarize(directory).status, 'passed')
	assert.equal(summarize(directory).orders.length, 8)
	assert.equal(summarize(directory, 'meadow').orders.length, 2)
	const file = path.join(directory, 'meadow-2.json')
	const record = JSON.parse(fs.readFileSync(file))
	fs.writeFileSync(file, JSON.stringify({ ...record, orderId: '100' }))
	assert.equal(summarize(directory).status, 'failed')
	fs.writeFileSync(file, JSON.stringify({ ...record, status: 'created' }))
	const partial = summarize(directory)
	assert.equal(partial.status, 'failed')
	assert.equal(partial.orders[7].orderId, record.orderId)
	assert.equal(partial.orders[7].status, 'created')
	fs.unlinkSync(file)
	assert.equal(summarize(directory).orders[7].status, 'not-started')
})
