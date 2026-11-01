const test = require('node:test')
const assert = require('node:assert/strict')
const { checkLiveReport } = require('./check-live-report')

const report = (overrides = {}) => ({ aggregate: { counters: {
	'vusers.created': 1, 'vusers.completed': 1,
	'live.rec-order.attempted': 1, 'live.rec-order.completed': 1, ...overrides,
} } })

test('smoke accepts omitted zero-failure counters but rejects empty and incomplete reports', () => {
	assert.equal(checkLiveReport(report()).completed, 1)
	assert.throws(() => checkLiveReport({}))
	assert.throws(() => checkLiveReport({ aggregate: { counters: {} } }))
	assert.throws(() => checkLiveReport(report({ 'vusers.created': 2 })))
	assert.throws(() => checkLiveReport(report({ 'vusers.skipped': 1 })))
})

test('confirmed order evidence is mandatory only when submission is enabled', () => {
	assert.throws(() => checkLiveReport(report(), { placeOrders: true }))
	assert.equal(checkLiveReport(report({ 'live.orders_confirmed': 1 }), { placeOrders: true }).orders, 1)
	assert.throws(() => checkLiveReport(report({ 'live.orders_confirmed': 1 })))
})

test('mixed ramp requires successful coverage of every journey', () => {
	assert.throws(() => checkLiveReport(report(), { scenario: 'mixed', profile: 'ramp' }))
	const counters = { 'vusers.created': 4, 'vusers.completed': 4 }
	for (const name of ['med-order', 'rec-account', 'med-account']) counters[`live.${name}.completed`] = 1
	assert.equal(checkLiveReport(report(counters), { scenario: 'mixed', profile: 'ramp' }).completed, 4)
})

test('ramp gates failed users, not the number of error events', () => {
	assert.equal(checkLiveReport(report({ 'vusers.created': 100, 'vusers.completed': 99, 'vusers.failed': 1 }), { profile: 'ramp' }).failed, 1)
	assert.throws(() => checkLiveReport(report({ 'vusers.created': 100, 'vusers.completed': 98, 'vusers.failed': 2 }), { profile: 'ramp' }))
})
