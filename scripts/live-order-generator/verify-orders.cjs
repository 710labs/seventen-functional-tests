const fs = require('node:fs')
const path = require('node:path')
const { STAGE_URL, selectTargets, transmissionProblem } = require('../../support/live-order-generator/targets.cjs')
const { posOrderDetails, externalOrderId, safePosOrderUrl } = require('../../support/live-order-generator/pos-links.cjs')
const { orderProfiles, isCustomerName } = require('../../support/live-order-generator/profiles.cjs')
const { readBatch } = require('../../support/live-order-generator/batch.cjs')
const { summarize } = require('./summarize.cjs')

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

// This uses the same reported transmission contract as the other health checks.
// Never persist response bodies or errors, which may include the auth query string.
async function verifyRecord(record, target, { auth, fetchImpl = globalThis.fetch, now = Date.now,
	sleep = delay, timeoutMs = 90000, intervalMs = 5000, save = () => {} } = {}) {
	record.status = 'created'
	record.phase = 'verification'
	// Keep previously captured IDs useful for investigation, while requiring
	// a fresh successful response before marking this verification as confirmed.
	record.externalId = externalOrderId(record.externalId)
	record.posOrderUrl = record.externalId ? safePosOrderUrl(record.posOrderUrl, target.pos) : null
	record.verification = { source: 'persy-qa-orders', attempts: 0, confirmed: false,
		reason: auth?.trim() ? 'POS API verification timed out' : 'Missing Stage QA authentication' }
	save()
	if (!auth?.trim()) return false
	const deadline = now() + timeoutMs
	while (now() < deadline) {
		record.verification.attempts++
		try {
			const url = new URL('/wp-content/plugins/persy/interface/qa/orders/', STAGE_URL)
			url.searchParams.set('auth', auth)
			url.searchParams.set('id', record.orderId)
			const response = await fetchImpl(url.href, { method: 'GET', redirect: 'error',
				signal: AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - now()))) })
			if (!response.ok) {
				record.verification.reason = 'POS API returned an unsuccessful HTTP response'
			} else {
				const body = await response.json()
				const details = posOrderDetails(body, target)
				if (details.externalId) {
					record.posOrderUrl = details.posOrderUrl || (record.externalId === details.externalId ? record.posOrderUrl : null)
					record.externalId = details.externalId
				}
				const problem = transmissionProblem(body, target)
				record.verification.reason = problem || (details.externalId ? null : 'Missing POS external order ID')
				if (!record.verification.reason) {
					record.verification.confirmed = true
					record.status = 'verified'
				}
			}
		} catch {
			record.verification.reason = 'POS API unavailable or invalid response'
		}
		record.verification.checkedAt = new Date(now()).toISOString()
		save()
		if (record.verification.confirmed) return true
		const remaining = deadline - now()
		if (remaining > 0) await sleep(Math.min(intervalMs, remaining))
	}
	return false
}

async function verifyOrders({ directory = path.resolve('output/live-order-generator'),
	selection = process.env.LIVE_ORDER_POS || 'all', auth = process.env.LIVE_STAGE_QA_AUTH, ...options } = {}) {
	const batch = readBatch(directory)
	if (!batch) throw new Error('Missing batch manifest')
	const entries = selectTargets(selection).flatMap(target => orderProfiles.map(profile => {
		const file = path.join(directory, `${target.pos}-${profile.sequence}.json`)
		let record
		try { record = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
		return { target, profile, file, record }
	})).filter(Boolean)
	const ids = entries.map(({ record }) => String(record?.orderId || '')).filter(Boolean)
	await Promise.all(entries.map(async ({ record, target, profile, file }) => {
		// Only query IDs captured from this batch's intended checkout. Never use
		// the latest orders or submit another order to replace a failed attempt.
		if (!record || !['created', 'verified'].includes(record.status) ||
			!/^\d+$/.test(String(record.orderId || '')) || ids.filter(id => id === String(record.orderId)).length !== 1 ||
			record.pos !== target.pos || record.instanceId !== target.instanceId || record.sequence !== profile.sequence ||
			record.batchId !== batch.batchId || record.userType !== profile.userType ||
			record.medicalProfileVerified !== (profile.userType === 'med') ||
			!isCustomerName(record.customerName, target.pos, profile, batch.batchId)) return
		await verifyRecord(record, target, { ...options, auth,
			save: () => fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n') })
	}))
	return summarize(directory, selection)
}

if (require.main === module) {
	require('dotenv').config()
	verifyOrders({ directory: process.env.LIVE_ORDER_RESULT_DIRECTORY || undefined }).then(result => {
		console.log(`POS API verification: ${result.orders.filter(order => order.status === 'verified').length}/${result.orders.length} confirmed`)
		process.exitCode = result.status === 'passed' ? 0 : 1
	}).catch(() => {
		console.error('POS API verification could not complete. Inspect the batch evidence before rerunning.')
		process.exitCode = 1
	})
}

module.exports = { verifyRecord, verifyOrders }
