const test = require('node:test')
const assert = require('node:assert/strict')
const { assertLiveTarget, buildPlan, phasesFor, buildUser, boolean, SCENARIOS } = require('./live-settings')

test('only the exact Live dev origin can receive load', () => {
	assert.equal(assertLiveTarget('https://live-dev.710labs.com/'), 'https://live-dev.710labs.com')
	for (const target of ['https://live-stage.710labs.com', 'https://live.710labs.com', 'https://thelist-dev.710labs.com', 'http://live-dev.710labs.com', 'https://live-dev.710labs.com.evil.test', 'https://user@live-dev.710labs.com', 'https://live-dev.710labs.com/?target=prod', 'https://live-dev.710labs.com/shop/']) {
		assert.throws(() => assertLiveTarget(target))
	}
})

test('mixed smoke guarantees one user for every journey, regardless of requested cap', () => {
	const plan = buildPlan({ scenario: 'mixed', browsers: 100 })
	assert.deepEqual(plan.matrix, SCENARIOS)
	assert.equal(plan.workers, 1)
	assert.equal(plan.browsers, 1)
	assert.deepEqual(phasesFor(plan), [{ name: 'one-user-smoke', duration: 1, arrivalCount: 1, maxVusers: 1 }])
	assert.equal(plan.placeOrders, false)
})

test('ramp worker caps sum exactly to the selected cap without multiplying load twice', () => {
	for (const browsers of [1, 5, 10, 20, 50, 100]) {
		const plan = buildPlan({ profile: 'ramp', scenario: 'mixed', browsers, duration: 600 })
		assert.deepEqual(plan.matrix, ['mixed'])
		assert.equal(plan.workers * plan.perWorker, browsers)
		assert.ok(plan.perWorker <= 10)
		assert.equal(phasesFor(plan)[1].duration, 600)
		assert.equal(phasesFor(plan)[1].arrivalRate, 1)
		assert.equal(phasesFor(plan)[1].maxVusers * plan.workers, browsers)
	}
})

test('invalid inputs fail before any workers can launch', () => {
	for (const input of [{ profile: 'flip' }, { scenario: 'prod' }, { browsers: 25 }, { browsers: '5x' }, { browsers: -1 }, { duration: '1; echo test' }, { duration: 1801 }, { placeOrders: 'yes' }, { capacity: 'invalid' }]) {
		assert.throws(() => buildPlan(input))
	}
	assert.equal(boolean('false'), false)
	assert.equal(boolean('true'), true)
})

test('virtual users have distinct identities even within one worker and millisecond', () => {
	const users = Array.from({ length: 1000 }, () => buildUser('12345-rec-order'))
	assert.equal(new Set(users.map(user => user.email)).size, users.length)
	assert.equal(new Set(users.map(user => user.updatedEmail)).size, users.length)
	assert.ok(users.every(user => user.email !== user.updatedEmail && user.email.split('@')[0].length <= 64))
})
