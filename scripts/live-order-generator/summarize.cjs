const fs = require('node:fs')
const path = require('node:path')
const { STAGE_URL, ORDERS_PER_POS, selectTargets } = require('../../support/live-order-generator/targets.cjs')
const { externalOrderId, safePosOrderUrl, configuredPosOrderUrl } = require('../../support/live-order-generator/pos-links.cjs')
const { orderProfiles, isCustomerName } = require('../../support/live-order-generator/profiles.cjs')

function summarize(directory, selection = 'all') {
	const orders = []
	const seen = new Set()
	for (const target of selectTargets(selection)) {
		for (const profile of orderProfiles) {
			const { sequence, userType } = profile
			const file = path.join(directory, `${target.pos}-${sequence}.json`)
			let record = {}
			let invalidEvidence = false
			try {
				if (fs.existsSync(file)) {
					record = JSON.parse(fs.readFileSync(file, 'utf8'))
					if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid evidence')
				}
			} catch { record = {}; invalidEvidence = true }
			// Preserve the actual account name; do not regenerate its timestamp at reporting time.
			const customerName = isCustomerName(record.customerName, target.pos, profile) ? record.customerName : null
			const orderId = /^\d+$/.test(String(record.orderId || '')) ? String(record.orderId) : null
			const statuses = ['started', 'submitting', 'created', 'verified', 'failed-before-submit']
			let status = statuses.includes(record.status) ? record.status : 'not-started'
			const matchesTarget = record.instanceId === target.instanceId && record.pos === target.pos && record.sequence === sequence
			const matchesProfile = record.userType === userType && customerName !== null &&
				record.medicalProfileVerified === (userType === 'med')
			const externalId = matchesTarget ? externalOrderId(record.externalId) : null
			const posOrderUrl = externalId ? safePosOrderUrl(record.posOrderUrl, target.pos) || configuredPosOrderUrl(externalId, target.pos) : null
			if (invalidEvidence || (status === 'verified' && (!orderId || !externalId || !matchesTarget || !matchesProfile))) {
				status = 'invalid-evidence'
			}
			if (orderId && seen.has(orderId)) status = 'duplicate-order-id'
			if (orderId) seen.add(orderId)
			const phase = ['registration', 'medical-profile', 'cart', 'checkout', 'submission', 'verification'].includes(record.phase) ? record.phase : 'setup'
			orders.push({ pos: target.pos, store: target.store, instanceId: target.instanceId, sequence,
				userType, customerType: profile.customerType, customerName,
				medicalProfileVerified: record.medicalProfileVerified === true,
				orderId, externalId, posOrderUrl, status, phase,
				adminUrl: orderId ? `${STAGE_URL}/wp-admin/post.php?post=${orderId}&action=edit` : null })
		}
	}
	return { environment: 'live-stage', ordersPerPos: ORDERS_PER_POS,
		status: orders.every(order => order.status === 'verified') ? 'passed' : 'failed', orders }
}

function markdown(result) {
	const tableText = value => String(value).replace(/\|/g, '&#124;').replace(/[<>]/g, '')
	return [
		'### Live Stage order generator', '',
		`Result: **${result.status}**. Requested ${result.orders.length} pickup orders (one recreational and one medical per POS).`, '',
		'| POS | Store | Customer type | First & last name | Woo order | POS order ID | POS link | Status | Phase |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
		...result.orders.map(order => `| ${order.pos} | ${order.store} | ${order.customerType} | ${order.customerName || '—'} | ${order.orderId ? `[${order.orderId}](${order.adminUrl})` : '—'} | ${order.externalId ? tableText(order.externalId) : '—'} | ${order.posOrderUrl ? `[Open POS order](<${order.posOrderUrl}>)` : 'Unavailable'} | ${order.status} | ${order.phase} |`),
		'', 'A submitting result may have created an order. Inspect Stage before rerunning; each new run creates two new orders per selected POS.', '',
	].join('\n')
}

if (require.main === module) {
	const directory = path.resolve('output/live-order-generator')
	const result = summarize(directory, process.env.LIVE_ORDER_POS || 'all')
	fs.mkdirSync(directory, { recursive: true })
	fs.writeFileSync(path.join(directory, 'orders.json'), JSON.stringify(result, null, 2) + '\n')
	const report = markdown(result)
	fs.writeFileSync(path.join(directory, 'summary.md'), report)
	if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
	console.log(report)
	process.exitCode = result.status === 'passed' ? 0 : 1
}

module.exports = { summarize, markdown }
