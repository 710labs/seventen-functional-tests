const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const { prepareLive } = require('./prepare-live')
const { buildPlan } = require('../flows/live-settings')

test('built worker bundle exports every scenario and all referenced fixtures exist', async () => {
	const files = await prepareLive(buildPlan({ profile: 'dry', scenario: 'mixed' }))
	assert.equal(files.length, 4)
	for (const file of files) {
		const config = yaml.safeLoad(fs.readFileSync(file, 'utf8'))
		const processor = require(path.resolve(path.dirname(file), config.config.processor))
		assert.equal(typeof processor[config.scenarios[0].testFunction], 'function')
		assert.equal(config.config.variables.livePlaceOrders, 'false')
		for (const fixture of config.config.includeFiles) assert.ok(fs.existsSync(path.resolve(path.dirname(file), fixture)))
		// No page/browser operation may occur for a disallowed configured target.
		await assert.rejects(() => processor[config.scenarios[0].testFunction]({}, { config: { target: 'https://live-stage.710labs.com' } }, {}, {}), /only support/)
	}
	const { finishLiveOrder } = require('../generated/live-funnel.cjs')
	let clicks = 0
	let failConfirmation = false
	const ids = []
	const page = { locator: selector => selector === '#place_order'
		? { click: async () => { clicks++ } }
		: { waitFor: async () => { if (failConfirmation) throw new Error('timeout') }, innerText: async () => '#12345' } }
	await finishLiveOrder(page, false, id => ids.push(id))
	assert.equal(clicks, 0, 'checkout-only runs must not submit')
	await finishLiveOrder(page, true, id => ids.push(id))
	assert.equal(clicks, 1)
	assert.deepEqual(ids, ['12345'])
	failConfirmation = true
	await assert.rejects(() => finishLiveOrder(page, true, id => ids.push(id)), /timeout/)
	assert.equal(clicks, 2, 'an ambiguous confirmation must not retry submission')
	assert.equal(ids.length, 1, 'failed confirmation must not report success')
})
