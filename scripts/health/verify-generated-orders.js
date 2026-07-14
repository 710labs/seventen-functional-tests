#!/usr/bin/env node
const { getCheck, writeResult } = require('./result-utils')

const id = process.argv[2]
const check = getCheck(id)
if (check.type !== 'generated-order-pos') throw new Error(`${id} is not a generated-order POS check`)

const startedAt = Date.now()
const baseUrl = (process.env.POS_BASE_URL || '').replace(/\/+$/, '')
const auth = process.env.POS_AUTH || ''
let orderIds = []

try {
	orderIds = JSON.parse(process.env.ORDER_IDS_JSON || '[]')
	if (!Array.isArray(orderIds)) throw new Error('ORDER_IDS_JSON must be an array')
} catch (error) {
	writeResult(check, { status: 'failed', failureSummary: [`Invalid order ID input: ${error.message}`] })
	process.exit(1)
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const isBlank = value => value === null || value === undefined || String(value).trim() === ''

async function verifyOrder(orderId) {
	let lastReason = 'No response received'
	for (let attempt = 1; attempt <= 6; attempt++) {
		try {
			const url = new URL('/wp-content/plugins/persy/interface/qa/orders/', `${baseUrl}/`)
			url.searchParams.set('auth', auth)
			url.searchParams.set('id', orderId)
			const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
			if (!response.ok) {
				lastReason = `HTTP ${response.status}`
			} else {
				const body = await response.json()
				if (body.outcome !== 'success') {
					lastReason = `outcome=${body.outcome || 'missing'}`
				} else {
					const normalized = {
						instanceId: body.instanceId ?? body.instanceID,
						instanceName: body.instanceName,
						instanceType: body.instanceType,
						externalId: body.externalId ?? body.externalID,
					}
					const missing = Object.entries(normalized)
						.filter(([, value]) => isBlank(value))
						.map(([field]) => field)
					if (!missing.length) return { orderId, passed: true }
					lastReason = `missing ${missing.join(', ')}`
				}
			}
		} catch (error) {
			lastReason = error.message
		}
		if (attempt < 6) await delay(10000)
	}
	return { orderId, passed: false, reason: lastReason }
}

async function main() {
	const setupProblems = []
	if (!baseUrl) setupProblems.push('POS_BASE_URL is not configured.')
	if (!auth) setupProblems.push('POS_AUTH is not configured.')
	if (!orderIds.length) setupProblems.push('No generated order IDs were available to verify.')

	const results = setupProblems.length ? [] : await Promise.all(orderIds.map(verifyOrder))
	const failures = results.filter(result => !result.passed)
	const failureSummary = [
		...setupProblems,
		...failures.map(result => `Order ${result.orderId}: ${result.reason}`),
	]
	const status = failureSummary.length ? 'failed' : 'passed'

	writeResult(check, {
		status,
		startedAt: new Date(startedAt).toISOString(),
		finishedAt: new Date().toISOString(),
		durationSeconds: Math.round((Date.now() - startedAt) / 1000),
		counts: {
			passed: results.filter(result => result.passed).length,
			failed: failures.length + setupProblems.length,
			flaky: 0,
			skipped: 0,
		},
		failureSummary,
		details: { orders: results },
	})

	process.exitCode = status === 'passed' ? 0 : 1
}

main().catch(error => {
	writeResult(check, {
		status: 'failed',
		failureSummary: [`Unexpected POS verification error: ${error.message}`],
	})
	process.exitCode = 1
})
