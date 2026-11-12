const { test } = require('node:test')
const assert = require('node:assert/strict')
const rules = require('../rules.json')
const { bindCategoryIds, remapPlanCategories } = require('../categories.cjs')
const { goldenPlans, resolvePlan } = require('../scenarios.cjs')
const { expectedCart } = require('../oracle.cjs')
const stageIds = { eighths: 325, 'persy-doinks': 324, 'gummis-2': 323, doinks: 320, 'live-rosin-vapes': 319, 'live-rosin-badder': 312 }

test('Stage category IDs bind by slug, never by category order or overlapping dev IDs', () => {
	const live = bindCategoryIds(rules, stageIds)
	assert.deepEqual(live.bulkRules.map(rule => [rule.categoryName, rule.categoryId]),
		[['Vapes', 319], ['Badder', 312], ['Gummis', 323], ['Eighths', 325], ['Doinks', 320]])
	assert.deepEqual(rules.bulkRules.map(rule => rule.categoryId), [323, 327, 324, 331, 326])
	assert.deepEqual(bindCategoryIds(rules, Object.fromEntries(Object.entries(stageIds).reverse())), live)
})

test('all browser journey plans preserve SKU slots and quantities when remapped to Stage', () => {
	const live = bindCategoryIds(rules, stageIds)
	const catalogue = live.bulkRules.flatMap(rule => [0, 1].map(index => ({
		productId: rule.categoryId * 10 + index, categoryIds: [rule.categoryId], unitPrice: '39.00', inStock: true,
	})))
	for (const id of ['J1', 'J2', 'J5']) {
		const plan = goldenPlans.find(plan => plan.id === id)
		const mapped = remapPlanCategories(plan, rules, live)
		assert.deepEqual(mapped.lines.map(line => [line.skuIndex, line.qty]), plan.lines.map(line => [line.skuIndex, line.qty]))
		const resolved = resolvePlan(mapped, catalogue, live)
		const result = expectedCart(resolved.expectedLines, 'plain', live)
		assert.equal(result.bulkTotal, { J1: 1500, J2: 11900, J5: 2400 }[id])
	}
})

test('missing, duplicated, and unknown category mappings fail explicitly', () => {
	assert.throws(() => bindCategoryIds(rules, { ...stageIds, eighths: undefined }), /eighths/)
	assert.throws(() => bindCategoryIds(rules, { ...stageIds, eighths: stageIds.doinks }), /doinks/)
	assert.throws(() => remapPlanCategories({ lines: [{ categoryId: 999 }] }, rules, rules), /Unmapped/)
	assert.equal(remapPlanCategories({ lines: [{ categoryId: null }] }, rules, rules).lines[0].categoryId, null)
})

test('optional Stage category discovery omits absent slugs without accepting invalid mappings', () => {
	const { eighths, ...partial } = stageIds
	const live = bindCategoryIds(rules, partial, { allowMissing: true })
	assert.deepEqual(live.bulkRules.map(rule => rule.categoryId), [319, 312, 323, 320])
	assert.throws(() => bindCategoryIds(rules, { ...partial, eighths: undefined }, { allowMissing: true }), /eighths/)
	assert.throws(() => bindCategoryIds(rules, { ...partial, eighths: stageIds.doinks }, { allowMissing: true }), /doinks/)
})
