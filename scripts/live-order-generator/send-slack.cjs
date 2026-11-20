const path = require('node:path')
const { summarize } = require('./summarize.cjs')

const escapeSlack = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function workflowRunUrl(env = process.env) {
	if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY || '') || !/^\d+$/.test(env.GITHUB_RUN_ID || '')) return null
	return `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
}

function buildSlackMessage(result, { jobStatus = 'success', runUrl = null } = {}) {
	const status = jobStatus === 'cancelled' ? 'CANCELLED' : result.status === 'passed' && jobStatus === 'success' ? 'PASSED' : 'FAILED'
	const created = new Set(result.orders.map(order => order.orderId).filter(Boolean)).size
	const verified = result.orders.filter(order => order.status === 'verified').length
	const heading = `Live Stage — Order Generator — ${status}`
	const counts = `${result.orders.length} requested • ${created} created • ${verified} POS verified`
	const rows = result.orders.map(order => {
		const woo = order.orderId ? `<${order.adminUrl}|Woo #${order.orderId}>` : 'Woo —'
		const id = order.externalId ? escapeSlack(order.externalId) : null
		const pos = id ? `POS ${order.posOrderUrl ? `<${order.posOrderUrl}|${id}>` : `\`${id.replace(/`/g, "'")}\``}` : 'POS —'
		const posName = order.pos.charAt(0).toUpperCase() + order.pos.slice(1)
		const icon = order.status === 'verified' ? '✅' : ['started', 'created', 'submitting'].includes(order.status) ? '⚠️' : '❌'
		const details = order.status === 'verified' ? '' : ` · ${order.status} (${order.phase})`
		return `${icon} *${posName} ${order.customerType === 'medical' ? 'Med' : 'Rec'}* · ${woo} · ${pos}${details}`
	})
	// Keep rows together instead of adding Block Kit spacing around every order.
	// Split only when needed to stay below Slack's 3,000-character section limit.
	const rowSections = []
	for (const row of rows) {
		const last = rowSections.length - 1
		if (last < 0 || rowSections[last].length + row.length + 1 > 3000) rowSections.push(row)
		else rowSections[last] += `\n${row}`
	}
	const note = result.orders.some(order => order.status === 'submitting')
		? '⚠️ An order may have been submitted without a captured ID. Inspect Stage before rerunning.' : null
	return {
		text: [heading, counts, ...rows, ...(note ? [note] : []), ...(runUrl ? [`Full report: ${runUrl}`] : [])].join('\n'),
		unfurl_links: false,
		unfurl_media: false,
		blocks: [
			{ type: 'header', text: { type: 'plain_text', text: heading } },
			{ type: 'section', text: { type: 'mrkdwn', text: counts } },
			...rowSections.map(text => ({ type: 'section', text: { type: 'mrkdwn', text } })),
			...(note ? [{ type: 'context', elements: [{ type: 'plain_text', text: note }] }] : []),
			...(runUrl ? [{ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Full report' }, url: runUrl }] }] : []),
		],
	}
}

async function sendSlack(message, webhookUrl, fetchImpl = globalThis.fetch) {
	let url
	try { url = new URL(webhookUrl) } catch { throw new Error('SLACK_WEBHOOK_URL is not configured correctly') }
	if (url.protocol !== 'https:' || !['hooks.slack.com', 'hooks.slack-gov.com'].includes(url.hostname) || url.username || url.password) {
		throw new Error('SLACK_WEBHOOK_URL must be a Slack incoming webhook')
	}
	// No automatic retries: an interrupted response may still have posted a message.
	const response = await fetchImpl(url.href, {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(message), signal: AbortSignal.timeout(20000), redirect: 'error',
	})
	if (!response.ok) throw new Error(`Slack returned HTTP ${response.status}`)
	if ((await response.text()).trim() !== 'ok') throw new Error('Slack did not acknowledge the message')
}

async function main() {
	const result = summarize(path.resolve('output/live-order-generator'), process.env.LIVE_ORDER_POS || 'all')
	const message = buildSlackMessage(result, { jobStatus: process.env.GENERATOR_JOB_STATUS || 'success', runUrl: workflowRunUrl() })
	await sendSlack(message, process.env.SLACK_WEBHOOK_URL)
	console.log('Live Stage order generator Slack summary sent.')
}

if (require.main === module) main().catch(() => {
	console.error('Live Stage order generator Slack delivery failed. Check SLACK_WEBHOOK_URL and Slack availability.')
	process.exitCode = 1
})

module.exports = { buildSlackMessage, workflowRunUrl, sendSlack }
