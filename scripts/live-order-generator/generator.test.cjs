const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { targets, assertStageUrl, selectTargets, transmissionProblem } = require('../../support/live-order-generator/targets.cjs')
const { summarize } = require('./summarize.cjs')
const { orderProfiles, customerName, isCustomerName } = require('../../support/live-order-generator/profiles.cjs')

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
		for (const profile of orderProfiles) {
			const { sequence, userType } = profile
			fs.writeFileSync(path.join(directory, `${target.pos}-${sequence}.json`), JSON.stringify({
				...target, sequence, orderId: String(order++), status: 'verified', externalId: 'external-order',
				userType, customerName: customerName(target.pos, profile), medicalProfileVerified: userType === 'med',
			}))
		}
	}
	assert.equal(summarize(directory).status, 'passed')
	assert.equal(summarize(directory).orders.length, 8)
	assert.deepEqual(summarize(directory).orders.map(order => order.userType), ['rec', 'med', 'rec', 'med', 'rec', 'med', 'rec', 'med'])
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

test('medical coverage requires a saved medical profile and cannot be satisfied by a second Rec order', t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-med-profile-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	assert.equal(orderProfiles.length, 2)
	const timestamp = new Date('2026-11-20T21:05:30.123Z')
	assert.equal(customerName('dutchie', orderProfiles[0], timestamp), 'Test_710Labs_Dutchie_Rec_20261120_160530_123')
	assert.equal(customerName('dutchie', orderProfiles[1], timestamp), 'Test_710Labs_Dutchie_Med_20261120_160530_123')
	const target = targets[0]
	for (const profile of orderProfiles) {
		fs.writeFileSync(path.join(directory, `dutchie-${profile.sequence}.json`), JSON.stringify({
			...target, sequence: profile.sequence, userType: profile.userType,
			customerName: customerName(target.pos, profile), medicalProfileVerified: profile.userType === 'med',
			status: 'verified', orderId: String(100 + profile.sequence), externalId: 'external-order',
		}))
	}
	assert.equal(summarize(directory, 'dutchie').status, 'passed')
	const file = path.join(directory, 'dutchie-2.json')
	const medical = JSON.parse(fs.readFileSync(file))
	fs.writeFileSync(file, JSON.stringify({ ...medical, medicalProfileVerified: false }))
	assert.equal(summarize(directory, 'dutchie').orders[1].status, 'invalid-evidence')
	fs.writeFileSync(file, JSON.stringify({ ...medical, userType: 'rec', customerName: 'Test_710Labs_Dutchie_Rec' }))
	assert.equal(summarize(directory, 'dutchie').status, 'failed')
})

test('timestamps distinguish names even within the same millisecond and reports retain the recorded name', t => {
	t.mock.method(Date, 'now', () => new Date('2026-11-20T21:05:30.123Z').getTime())
	assert.notEqual(customerName('dutchie', orderProfiles[0]), customerName('dutchie', orderProfiles[0]))
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-timestamped-names-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	const profile = orderProfiles[0]
	const recordedName = customerName('dutchie', profile, new Date('2026-01-15T05:00:00.007Z'))
	assert.equal(recordedName, 'Test_710Labs_Dutchie_Rec_20260115_000000_007')
	assert.equal(isCustomerName(recordedName, 'dutchie', profile), true)
	assert.equal(isCustomerName(recordedName, 'dutchie', orderProfiles[1]), false)
	assert.equal(isCustomerName('Test_710Labs_Dutchie_Rec', 'dutchie', profile), false)
	fs.writeFileSync(path.join(directory, 'dutchie-1.json'), JSON.stringify({
		...targets[0], sequence: 1, userType: 'rec', customerName: recordedName,
		medicalProfileVerified: false, status: 'verified', orderId: '123', externalId: 'pos-123',
	}))
	const report = summarize(directory, 'dutchie')
	assert.equal(report.orders[0].status, 'verified')
	assert.equal(report.orders[0].customerName, recordedName)
	assert.equal(report.orders[1].customerName, null)
})
