const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { verifyRecord, verifyOrders } = require('./verify-orders.cjs')
const { targets } = require('../../support/live-order-generator/targets.cjs')
const { orderProfiles, customerName } = require('../../support/live-order-generator/profiles.cjs')
const { createBatch } = require('../../support/live-order-generator/batch.cjs')

const response = body => ({ ok: true, json: async () => body })
const success = target => ({ outcome: 'success', instanceId: target.instanceId,
	instanceType: target.pos, instanceName: 'Sandbox', externalId: `external-${target.pos}` })
function clock() {
	let timestamp = Date.parse('2026-11-25T10:17:00Z')
	return { now: () => timestamp, sleep: async milliseconds => { timestamp += milliseconds }, timeoutMs: 10000 }
}
function fixture(t, selection = targets) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-api-verification-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	const { batchId } = createBatch(directory)
	let id = 100
	for (const target of selection) for (const profile of orderProfiles) {
		fs.writeFileSync(path.join(directory, `${target.pos}-${profile.sequence}.json`), JSON.stringify({
			...target, batchId, sequence: profile.sequence, userType: profile.userType,
			customerName: customerName(target.pos, profile, batchId), medicalProfileVerified: profile.userType === 'med',
			orderId: String(id++), status: 'created', phase: 'verification',
		}))
	}
	return directory
}

test('polls the captured Woo ID until its expected POS transmission is confirmed', async () => {
	const target = targets[0]
	const record = { orderId: '78041', status: 'created' }
	let requests = 0
	let saves = 0
	assert.equal(await verifyRecord(record, target, { ...clock(), auth: 'test-auth', save: () => saves++,
		fetchImpl: async (raw, options) => {
			const url = new URL(raw)
			assert.equal(url.origin, 'https://live-stage.710labs.com')
			assert.equal(url.searchParams.get('id'), '78041')
			assert.equal(url.searchParams.get('auth'), 'test-auth')
			assert.equal(options.method, 'GET')
			assert.equal(options.redirect, 'error')
			return response(++requests === 1 ? { outcome: 'pending' } : success(target))
		} }), true)
	assert.equal(requests, 2)
	assert.equal(saves, 3)
	assert.equal(record.status, 'verified')
	assert.equal(record.externalId, 'external-dutchie')
	assert.deepEqual(record.verification, { source: 'persy-qa-orders', attempts: 2, confirmed: true,
		reason: null, checkedAt: '2026-11-25T10:17:05.000Z' })
})

test('pending, wrong instance, wrong type, or incomplete transmission never passes', async () => {
	for (const body of [
		{ ...success(targets[0]), outcome: 'pending' },
		{ ...success(targets[0]), instanceId: '4' },
		{ ...success(targets[0]), instanceType: 'Blaze' },
		{ ...success(targets[0]), externalId: '' },
		{ ...success(targets[0]), instanceName: '' },
	]) {
		const record = { orderId: '78041', status: 'verified', externalId: 'stale-id' }
		assert.equal(await verifyRecord(record, targets[0], { ...clock(), auth: 'test-auth', fetchImpl: async () => response(body) }), false)
		assert.equal(record.status, 'created')
		assert.equal(record.orderId, '78041')
		assert.equal(record.verification.confirmed, false)
		assert.equal(record.verification.attempts, 2)
	}
})

test('HTTP, network/timeout, and invalid JSON failures retain IDs without leaking secrets', async () => {
	for (const fetchImpl of [
		async () => ({ ok: false, status: 503 }),
		async () => { throw new Error('SECRET_AUTH customer@example.com') },
		async () => ({ ok: true, json: async () => { throw new Error('SECRET_RESPONSE') } }),
	]) {
		const record = { orderId: '78041', externalId: 'previously-captured-id' }
		assert.equal(await verifyRecord(record, targets[0], { ...clock(), auth: 'SECRET_AUTH', fetchImpl }), false)
		assert.equal(record.orderId, '78041')
		assert.equal(record.externalId, 'previously-captured-id')
		assert.doesNotMatch(JSON.stringify(record), /SECRET|customer@example/)
	}
	const record = { orderId: '78041' }
	assert.equal(await verifyRecord(record, targets[0], { fetchImpl: async () => { assert.fail('Missing auth must not call API') } }), false)
	assert.equal(record.verification.attempts, 0)
})

test('verifies all eight captured orders and persists API evidence per order', async t => {
	const directory = fixture(t)
	const checked = []
	const result = await verifyOrders({ directory, selection: 'all', auth: 'test-auth', ...clock(),
		fetchImpl: async raw => {
			const id = new URL(raw).searchParams.get('id')
			checked.push(id)
			return response(success(targets[Math.floor((Number(id) - 100) / 2)]))
		} })
	assert.equal(result.status, 'passed')
	assert.deepEqual(checked.sort(), ['100', '101', '102', '103', '104', '105', '106', '107'])
	assert.ok(result.orders.every(order => order.status === 'verified' && order.verification.confirmed && order.verification.checkedAt))
})

test('partial checkout verifies existing orders but fails missing coverage without submitting replacements', async t => {
	const directory = fixture(t, [targets[0]])
	const file = path.join(directory, 'dutchie-2.json')
	fs.unlinkSync(file)
	let requests = 0
	const result = await verifyOrders({ directory, selection: 'all', auth: 'test-auth', ...clock(),
		fetchImpl: async () => { requests++; return response(success(targets[0])) } })
	assert.equal(requests, 1)
	assert.equal(result.status, 'failed')
	assert.equal(result.orders[0].status, 'verified')
	assert.equal(result.orders[1].status, 'not-started')
})

test('reports retain fixed API failure reasons and discard arbitrary response text', async t => {
	const directory = fixture(t, [targets[0]])
	const result = await verifyOrders({ directory, selection: 'dutchie', auth: 'test-auth', ...clock(),
		fetchImpl: async () => response({ outcome: 'pending', message: 'SECRET_RESPONSE' }) })
	assert.ok(result.orders.every(order => order.verification.reason === 'POS transmission is not successful yet'))
	const file = path.join(directory, 'dutchie-1.json')
	const record = JSON.parse(fs.readFileSync(file))
	record.verification.reason = 'SECRET_RESPONSE'
	fs.writeFileSync(file, JSON.stringify(record))
	const { summarize, markdown } = require('./summarize.cjs')
	const summary = summarize(directory, 'dutchie')
	assert.doesNotMatch(JSON.stringify(summary) + markdown(summary), /SECRET/)
})

test('rejects mixed batch, wrong profile, corrupt evidence, and duplicate IDs before making API calls', async t => {
	for (const update of [record => ({ ...record, batchId: 'OTHER1' }), record => ({ ...record, userType: 'rec' }),
		record => ({ ...record, instanceId: '4' }), record => ({ ...record, orderId: '100' }), () => null]) {
		const directory = fixture(t, [targets[0]])
		const file = path.join(directory, 'dutchie-2.json')
		fs.writeFileSync(file, JSON.stringify(update(JSON.parse(fs.readFileSync(file)))))
		const checked = []
		const result = await verifyOrders({ directory, selection: 'dutchie', auth: 'test-auth', ...clock(),
			fetchImpl: async raw => { checked.push(new URL(raw).searchParams.get('id')); return response(success(targets[0])) } })
		assert.equal(result.status, 'failed')
		assert.ok(!checked.includes('101'))
	}
})
