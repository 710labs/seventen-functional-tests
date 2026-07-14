#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { getCheck, writeResult } = require('./result-utils')

const check = getCheck(process.argv[2] || 'live-stage-pos-last-10')
const startedAt = Date.now()
const baseUrl = (process.env.POS_BASE_URL || '').replace(/\/+$/, '')
const auth = process.env.POS_AUTH || ''
const evidenceDirectory = path.join('health-evidence', check.id)

const isBlank = value => value === null || value === undefined || String(value).trim() === ''

const normalizeOrder = order => ({
	orderId: order.woocommerceId,
	instanceId: order.instanceId ?? order.instanceID,
	instanceName: order.instanceName,
	instanceType: order.instanceType,
	externalId: order.externalId ?? order.externalID,
})

async function main() {
	if (!baseUrl || !auth) {
		const missing = [!baseUrl && 'POS_BASE_URL', !auth && 'POS_AUTH'].filter(Boolean)
		throw new Error(`Missing required configuration: ${missing.join(', ')}`)
	}

	const url = new URL('/wp-content/plugins/persy/interface/qa/orders/', `${baseUrl}/`)
	url.searchParams.set('auth', auth)
	const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) })
	const text = await response.text()
	fs.mkdirSync(evidenceDirectory, { recursive: true })
	if (!response.ok) throw new Error(`POS API returned HTTP ${response.status}`)

	let body
	try {
		body = JSON.parse(text)
	} catch {
		throw new Error('POS API response was not valid JSON')
	}

	const orders = Array.isArray(body.orders) ? body.orders.slice(0, 10) : []
	if (!orders.length) throw new Error('POS API returned no orders')

	const sanitized = orders.map(normalizeOrder)
	fs.writeFileSync(
		path.join(evidenceDirectory, 'orders-evidence.json'),
		`${JSON.stringify({ ordersChecked: orders.length, orders: sanitized }, null, 2)}\n`,
	)

	const failures = orders
		.map(order => {
			const { orderId, ...fields } = normalizeOrder(order)
			return {
				orderId,
				missing: Object.entries(fields).filter(([, value]) => isBlank(value)).map(([field]) => field),
			}
		})
		.filter(order => order.missing.length)

	const status = failures.length ? 'failed' : 'passed'
	writeResult(check, {
		status,
		startedAt: new Date(startedAt).toISOString(),
		finishedAt: new Date().toISOString(),
		durationSeconds: Math.round((Date.now() - startedAt) / 1000),
		counts: { passed: orders.length - failures.length, failed: failures.length, flaky: 0, skipped: 0 },
		failureSummary: failures.map(order => `Order ${order.orderId}: missing ${order.missing.join(', ')}`),
		details: { ordersChecked: orders.length, failures },
	})
	process.exitCode = status === 'passed' ? 0 : 1
}

main().catch(error => {
	writeResult(check, {
		status: 'failed',
		startedAt: new Date(startedAt).toISOString(),
		finishedAt: new Date().toISOString(),
		durationSeconds: Math.round((Date.now() - startedAt) / 1000),
		counts: { passed: 0, failed: 1, flaky: 0, skipped: 0 },
		failureSummary: [error.message],
	})
	process.exitCode = 1
})
