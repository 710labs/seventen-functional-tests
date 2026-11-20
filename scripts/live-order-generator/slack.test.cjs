const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { targets } = require('../../support/live-order-generator/targets.cjs')
const { orderProfiles, customerName } = require('../../support/live-order-generator/profiles.cjs')
const { posOrderDetails, safePosOrderUrl, configuredPosOrderUrl } = require('../../support/live-order-generator/pos-links.cjs')
const { summarize, markdown } = require('./summarize.cjs')
const { buildSlackMessage, workflowRunUrl, sendSlack } = require('./send-slack.cjs')

function fixture(t) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-slack-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	let id = 100
	for (const target of targets) for (const profile of orderProfiles) {
		const { sequence, userType } = profile
		fs.writeFileSync(path.join(directory, `${target.pos}-${sequence}.json`), JSON.stringify({
			...target, sequence, orderId: String(id++), externalId: `pos-${target.pos}-${sequence}`,
			userType, customerName: customerName(target.pos, profile), medicalProfileVerified: userType === 'med',
			status: 'verified', phase: 'verification', password: 'must-not-be-published',
		}))
	}
	return directory
}

test('captures provider links and external IDs only for the expected POS identity', () => {
	const target = targets[2]
	const body = { instanceID: '15', instanceType: 'Treez (v3)', externalID: 'a/b', posOrderURL: 'https://partnersandbox3.treez.io/confirmed-order/a%2Fb' }
	assert.deepEqual(posOrderDetails(body, target, {}), { externalId: 'a/b', posOrderUrl: body.posOrderURL })
	assert.deepEqual(posOrderDetails({ ...body, instanceID: '4' }, target, {}), { externalId: null, posOrderUrl: null })
	assert.deepEqual(posOrderDetails({ ...body, instanceType: 'Blaze' }, target, {}), { externalId: null, posOrderUrl: null })
	assert.equal(configuredPosOrderUrl('a/b', 'treez', { LIVE_STAGE_TREEZ_ORDER_URL_TEMPLATE: 'https://partnersandbox3.treez.io/confirmed-order/{externalId}' }), body.posOrderURL)
	assert.equal(configuredPosOrderUrl('a/b', 'treez', {}), null)
	assert.equal(posOrderDetails({ ...body, posOrderURL: undefined }, target, {}).posOrderUrl, null)
	for (const url of [
		'javascript:alert(1)', 'http://partnersandbox3.treez.io/order/1',
		'https://treez.io.evil.test/order/1', 'https://app.blaze.me/order/1',
		'https://user:password@partnersandbox3.treez.io/order/1',
		'https://partnersandbox3.treez.io/order/1?auth=secret',
		'https://partnersandbox3.treez.io/order/1#?access_token=secret',
	]) assert.equal(safePosOrderUrl(url, 'treez'), null)
})

test('Slack and artifact summaries include all eight Woo IDs and POS IDs without requiring direct POS links', t => {
	const directory = fixture(t)
	const result = summarize(directory)
	const runUrl = workflowRunUrl({ GITHUB_REPOSITORY: '710labs/seventen-functional-tests', GITHUB_RUN_ID: '123' })
	const message = buildSlackMessage(result, { runUrl })
	assert.match(message.text, /PASSED/)
	assert.match(message.text, /8 requested • 8 created • 8 POS verified/)
	for (const order of result.orders) {
		assert.ok(message.text.includes(`<${order.adminUrl}|Woo #${order.orderId}>`))
		assert.ok(message.text.includes(order.externalId))
		assert.ok(markdown(result).includes(order.externalId))
		assert.equal(message.text.includes(order.customerName), false)
		assert.ok(markdown(result).includes(order.customerName))
		assert.ok(markdown(result).includes(order.customerType))
	}
	assert.match(message.text, /✅ \*Dutchie Rec\*/)
	assert.match(message.text, /✅ \*Dutchie Med\*/)
	assert.equal(message.blocks.filter(block => block.type === 'section').length, 2)
	assert.equal(message.blocks[2].text.text.split('\n').length, 8)
	assert.equal(message.text.includes('direct link unavailable'), false)
	assert.equal(message.text.includes('Phase:'), false)
	assert.equal(message.blocks.some(block => block.type === 'context'), false)
	assert.equal(message.blocks.at(-1).elements[0].url, runUrl)
	assert.equal(JSON.stringify(message).includes('must-not-be-published'), false)
	assert.equal(message.unfurl_links, false)
	assert.ok(message.blocks.length <= 50)
	assert.ok(message.blocks.filter(block => block.type === 'section').every(block => block.text.text.length <= 3000))
})

test('partial failures, corrupt evidence, and setup failures still account for every requested order', t => {
	const directory = fixture(t)
	fs.unlinkSync(path.join(directory, 'meadow-2.json'))
	fs.writeFileSync(path.join(directory, 'treez-2.json'), '{incomplete')
	const file = path.join(directory, 'blaze-2.json')
	const record = JSON.parse(fs.readFileSync(file))
	fs.writeFileSync(file, JSON.stringify({ ...record, status: 'created', posOrderUrl: 'https://app.blaze.me/confirmed-order/1' }))
	const result = summarize(directory)
	assert.equal(result.orders.length, 8)
	assert.equal(result.status, 'failed')
	assert.equal(result.orders[5].status, 'invalid-evidence')
	assert.equal(result.orders[7].status, 'not-started')
	assert.equal(result.orders[3].orderId, record.orderId)
	assert.equal(result.orders[3].posOrderUrl, 'https://app.blaze.me/confirmed-order/1')
	const message = buildSlackMessage(result)
	assert.match(message.text, /FAILED/)
	assert.ok(message.text.includes(`<${result.orders[3].posOrderUrl}|${result.orders[3].externalId}>`))
	assert.ok(message.text.includes('created (verification)'))
	assert.ok(message.text.includes('not-started'))
	assert.ok(message.text.includes('invalid-evidence'))
	assert.ok(markdown(result).includes('Open POS order'))
	const allMissing = summarize(path.join(directory, 'nonexistent'))
	assert.match(buildSlackMessage(allMissing).text, /8 requested • 0 created • 0 POS verified/)
	assert.match(buildSlackMessage(result, { jobStatus: 'cancelled' }).text, /CANCELLED/)
	assert.match(buildSlackMessage({ ...result, status: 'passed' }, { jobStatus: 'failure' }).text, /FAILED/)
	const ambiguous = { ...result, orders: [{ ...result.orders[0], status: 'submitting', phase: 'submission', orderId: null }] }
	assert.match(buildSlackMessage(ambiguous).text, /Inspect Stage before rerunning/)
	assert.equal(buildSlackMessage(ambiguous).blocks.filter(block => block.type === 'context').length, 1)
})

test('long POS IDs and links stay intact while compact rows respect section size limits', t => {
	const directory = fixture(t)
	const domains = { dutchie: 'dutchie.com', blaze: 'blaze.me', treez: 'treez.io', meadow: 'getmeadow.com' }
	for (const file of fs.readdirSync(directory)) {
		const record = JSON.parse(fs.readFileSync(path.join(directory, file)))
		record.externalId = 'id-' + 'x'.repeat(180)
		record.posOrderUrl = `https://${domains[record.pos]}/confirmed-order/${'x'.repeat(850)}`
		fs.writeFileSync(path.join(directory, file), JSON.stringify(record))
	}
	const result = summarize(directory)
	const message = buildSlackMessage(result)
	const sections = message.blocks.filter(block => block.type === 'section').slice(1)
	assert.ok(sections.length > 1)
	assert.equal(sections.flatMap(block => block.text.text.split('\n')).length, 8)
	assert.ok(sections.every(block => block.text.text.length <= 3000))
	for (const order of result.orders) {
		assert.ok(message.text.includes(`<${order.adminUrl}|Woo #${order.orderId}>`))
		assert.ok(message.text.includes(`<${order.posOrderUrl}|${order.externalId}>`))
	}
})

test('sender posts one complete payload, checks acknowledgement, and does not retry failed deliveries', async () => {
	const message = { text: 'Synthetic order generator summary' }
	let calls = 0
	await sendSlack(message, 'https://hooks.slack.com/services/synthetic', async (url, options) => {
		calls++
		assert.equal(options.method, 'POST')
		assert.equal(options.redirect, 'error')
		assert.deepEqual(JSON.parse(options.body), message)
		return { ok: true, text: async () => 'ok' }
	})
	assert.equal(calls, 1)
	await assert.rejects(sendSlack(message, 'https://hooks.slack.com/services/synthetic', async () => {
		calls++
		return { ok: false, status: 503 }
	}), /HTTP 503/)
	assert.equal(calls, 2)
	await assert.rejects(sendSlack(message, 'https://hooks.slack.com/services/synthetic', async () => ({ ok: true, text: async () => 'error' })), /acknowledge/)
	await assert.rejects(sendSlack(message, undefined), /not configured/)
	await assert.rejects(sendSlack(message, 'https://example.com/webhook'), /Slack incoming webhook/)
})
