const { randomUUID, randomInt } = require('node:crypto')

const LIVE_TARGET = 'https://live-dev.710labs.com'
const SCENARIOS = ['rec-order', 'med-order', 'rec-account', 'med-account']
const FUNCTIONS = {
	'rec-order': 'liveRecOrder',
	'med-order': 'liveMedOrder',
	'rec-account': 'liveRecAccount',
	'med-account': 'liveMedAccount',
}

function assertLiveTarget(value = LIVE_TARGET) {
	const url = new URL(value)
	if (url.origin !== LIVE_TARGET || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
		throw new Error('Live load tests only support https://live-dev.710labs.com')
	}
	return LIVE_TARGET
}

function boolean(value, fallback = false) {
	if (value === undefined || value === '') return fallback
	if (value === true || value === 'true') return true
	if (value === false || value === 'false') return false
	throw new Error(`Expected true or false, received ${value}`)
}

function integer(value, min, max, name) {
	if (!/^\d+$/.test(String(value)) || Number(value) < min || Number(value) > max) {
		throw new Error(`${name} must be an integer between ${min} and ${max}`)
	}
	return Number(value)
}

function buildPlan(input = {}) {
	const target = assertLiveTarget(input.target)
	const profile = input.profile || 'smoke'
	const scenario = input.scenario || 'rec-order'
	if (!['dry', 'smoke', 'ramp'].includes(profile)) throw new Error('Invalid Live profile')
	if (![...SCENARIOS, 'mixed'].includes(scenario)) throw new Error('Invalid Live scenario')
	const requestedBrowsers = integer(input.browsers || 1, 1, 100, 'browsers')
	if (![1, 5, 10, 20, 50, 100].includes(requestedBrowsers)) throw new Error('Invalid browser preset')
	const duration = integer(input.duration || 300, 60, 1800, 'duration')
	const capacity = input.capacity || 'on_demand'
	if (!['on_demand', 'spot'].includes(capacity)) throw new Error('Invalid Fargate capacity')
	const browsers = profile === 'ramp' ? requestedBrowsers : 1
	const workers = Math.ceil(browsers / 10)
	return {
		target, profile, scenario, browsers, workers, duration, capacity,
		perWorker: browsers / workers,
		placeOrders: boolean(input.placeOrders),
		// Each smoke job gets exactly one user, including every branch of mixed.
		matrix: scenario === 'mixed' && profile !== 'ramp' ? SCENARIOS : [scenario],
	}
}

function phasesFor(plan) {
	if (plan.profile !== 'ramp') {
		return [{ name: 'one-user-smoke', duration: 1, arrivalCount: 1, maxVusers: 1 }]
	}
	return [
		{ name: 'ramp', duration: 120, arrivalRate: 0.1, rampTo: 1, maxVusers: plan.perWorker },
		{ name: 'sustain', duration: plan.duration, arrivalRate: 1, maxVusers: plan.perWorker },
	]
}

function buildUser(runId = 'local') {
	const run = String(runId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 24) || 'local'
	const id = randomUUID()
	return {
		id,
		email: `lt-${run}-${id.replace(/-/g, '').slice(0, 24)}@test.com`,
		updatedEmail: `lu-${run}-${id.replace(/-/g, '').slice(0, 24)}@test.com`,
		firstName: 'Loadtest',
		lastName: id.replace(/-/g, '').slice(0, 12),
		phone: `555${randomInt(1000000, 10000000)}`,
		dob: '1990-01-01',
	}
}

module.exports = { LIVE_TARGET, SCENARIOS, FUNCTIONS, assertLiveTarget, boolean, buildPlan, phasesFor, buildUser }
