const { test } = require('node:test')
const assert = require('node:assert/strict')
const { rulesForEnvironment } = require('../tax-profiles.cjs')
const { expectedCart } = require('../oracle.cjs')
const rules = require('../rules.json')
const dev = 'https://thelist-dev.710labs.com'
const stage = 'https://thelist-stage.710labs.com'
const eighths = { productId: 1, categoryIds: [331], qty: 3, unitPrice: '39.00', isFreeBogoUnit: false }


test('Stage profile reproduces the observed discounted Rainbow Belts cart', () => {
	const result = expectedCart([eighths], 'plain', rulesForEnvironment(stage))
	assert.deepEqual([result.subtotal, result.bulkTotal, result.discountedSubtotal,
		result.gross, result.excise, result.sales, result.total], [11700, 1500, 10200, 816, 1652, 1203, 13871])
})

test('environment profiles preserve dev rates and shared tier definitions', () => {
	const devRules = rulesForEnvironment(dev)
	const stageRules = rulesForEnvironment(`${stage}/`)
	assert.deepEqual(devRules.taxes.map(tax => tax.rateBasisPoints), [1100, 1500, 950])
	assert.deepEqual(stageRules.taxes.map(tax => tax.rateBasisPoints), [800, 1500, 950])
	assert.deepEqual(stageRules.bulkRules.map(({ couponKey, enabled, ...rule }) => rule),
		devRules.bulkRules.map(({ couponKey, enabled, ...rule }) => rule))
	assert.equal(stageRules.bulkRules.find(rule => rule.categorySlug === 'live-rosin-vapes').couponKey, 'live-rosin-vapes')
	assert.equal(devRules.bulkRules.find(rule => rule.categorySlug === 'live-rosin-vapes').couponKey, 'live-rosin-vapes-bulk-discount')
	assert.equal(stageRules.bulkRules.find(rule => rule.categorySlug === 'live-rosin-badder').couponKey, 'live-rosin-badder')
	assert.equal(devRules.bulkRules.find(rule => rule.categorySlug === 'live-rosin-badder').couponKey, 'live-rosin')
	assert.equal(stageRules.bulkRules.find(rule => rule.categorySlug === 'doinks').enabled, false)
	assert.notEqual(devRules.bulkRules.find(rule => rule.categorySlug === 'doinks').enabled, false)
	assert.deepEqual(expectedCart([eighths], 'plain', devRules).discountLines,
		expectedCart([eighths], 'plain', stageRules).discountLines)
	assert.notEqual(expectedCart([eighths], 'plain', devRules).total,
		expectedCart([eighths], 'plain', stageRules).total)
})

test('Stage Doinks remain full price while dev retains both discount tiers', () => {
	for (const [qty, devDiscount] of [[2, 0], [3, 900], [4, 1200], [5, 2500], [6, 3000]]) {
		const cart = [{ ...eighths, categoryIds: [326], qty, unitPrice: '14.00' }]
		const stageResult = expectedCart(cart, 'plain', rulesForEnvironment(stage))
		assert.equal(stageResult.bulkTotal, 0)
		assert.equal(stageResult.discountedSubtotal, qty * 1400)
		assert.deepEqual(stageResult.discountLines, [])
		assert.equal(expectedCart(cart, 'plain', rulesForEnvironment(dev)).bulkTotal, devDiscount)
	}
})

test('Stage mixed carts retain every product while discounting exactly four categories', () => {
	const profile = rulesForEnvironment(stage)
	const cart = profile.bulkRules.map((rule, index) => ({
		...eighths, productId: index + 1, categoryIds: [rule.categoryId], qty: 5,
	}))
	const result = expectedCart(cart, 'plain', profile)
	assert.equal(result.subtotal, 97500)
	assert.equal(result.bulkTotal, 13000)
	assert.equal(result.discountLines.length, 4)
	assert.ok(result.discountLines.every(line => line.categoryId !== 326))
	profile.bulkRules[0].enabled = 'false'
	assert.throws(() => expectedCart(cart, 'plain', profile), /Invalid bulk rule enabled flag/)
})

test('Stage per-line rounding reproduces both observed mixed-SKU tier carts', () => {
	for (const [qty, amounts] of [
		[1, [13600, 1088, 2203, 1604, 18495]],
		[2, [16000, 1280, 2592, 1888, 21760]],
	]) {
		const result = expectedCart([eighths, { ...eighths, productId: 2, qty }], 'plain', rulesForEnvironment(stage))
		assert.deepEqual([result.discountedSubtotal, result.gross, result.excise, result.sales, result.total], amounts)
	}
})

test('profiles cannot mutate shared dev, Stage, or workbook expectations', () => {
	rulesForEnvironment(stage).taxes[0].rateBasisPoints = 1
	rulesForEnvironment(dev).bulkRules[0].tiers[0].amountPerUnit = '99.00'
	assert.equal(rulesForEnvironment(stage).taxes[0].rateBasisPoints, 800)
	assert.equal(rulesForEnvironment(dev).bulkRules[0].tiers[0].amountPerUnit, '5.00')
	assert.deepEqual(rules.taxes.map(tax => tax.rateBasisPoints), [800, 1500, 775])
})

test('unknown or malformed environments cannot silently use dev tax rates', () => {
	for (const origin of [undefined, '', 'https://thelist.710labs.com', `${stage}.example.org`, `${stage}/cart/`]) {
		assert.throws(() => rulesForEnvironment(origin))
	}
})
