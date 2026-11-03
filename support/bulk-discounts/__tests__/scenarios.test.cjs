const { test } = require('node:test')
const assert = require('node:assert/strict')
const rules = require('../rules.json')
const { goldenPlans, samplePlans, resolvePlan, coverageCarts, mutationPlans } = require('../scenarios.cjs')
const { expectedCart } = require('../oracle.cjs')

const catalogue = rules.bulkRules.flatMap(rule => [0, 1, 2].map(index => ({
	productId: rule.categoryId * 10 + index, categoryIds: [rule.categoryId], unitPrice: String(39 + 6 * index), inStock: true,
})))
catalogue.push({ productId: rules.bogo.productId, categoryIds: [331], unitPrice: '39.00', inStock: true })

test('default samples contain 200 carts and every final golden cart', () => {
	const plans = samplePlans()
	assert.equal(plans.length, 200)
	assert.deepEqual(plans.slice(0, goldenPlans.length), goldenPlans)
	assert.equal(new Set(plans.map(plan => plan.id)).size, 200)
	assert.deepEqual(goldenPlans.map(plan => plan.id), ['J0', 'J1', 'J2', 'J3', 'J4', 'J5', 'J7'])
})

test('same seed is reproducible and a different seed changes sampled carts', () => {
	assert.deepEqual(samplePlans({ seed: 1234 }), samplePlans({ seed: 1234 }))
	assert.notDeepEqual(samplePlans({ seed: 1234 }), samplePlans({ seed: 1235 }))
	for (const seed of [-1, 1.5, NaN, 2 ** 32]) assert.throws(() => samplePlans({ seed }))
	assert.throws(() => samplePlans({ count: 6 }))
})

test('sample covers every category boundary and all user/BOGO combinations', () => {
	const sampled = samplePlans().slice(goldenPlans.length)
	for (const rule of rules.bulkRules) {
		const observed = new Set(sampled.map(plan => plan.lines.filter(line => line.categoryId === rule.categoryId).reduce((sum, line) => sum + line.qty, 0)))
		assert.deepEqual([...observed].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 10])
	}
	assert.equal(new Set(sampled.map(plan => `${plan.user}:${plan.bogo}`)).size, 4)
	for (const plan of sampled) {
		for (const rule of rules.bulkRules) assert.ok(plan.lines.filter(line => line.categoryId === rule.categoryId).length <= 3)
	}
})

test('golden J7 returns to two paid eighths and free units are never add-item requests', () => {
	const resolved = resolvePlan(goldenPlans.find(plan => plan.id === 'J7'), catalogue)
	assert.ok(resolved.requests.every(line => !line.isFreeBogoUnit))
	assert.equal(resolved.expectedLines.find(line => line.isFreeBogoUnit).qty, 2)
	const result = expectedCart(resolved.expectedLines)
	assert.equal(result.perCategoryQty[331], 2)
	assert.deepEqual(result.discountLines.map(line => line.categoryId), [324])
})

test('runtime prices drive expectations; product order does not affect reproducibility', () => {
	for (const plan of samplePlans()) {
		const resolved = resolvePlan(plan, catalogue)
		assert.deepEqual(resolved, resolvePlan(plan, [...catalogue].reverse()))
		const expected = expectedCart(resolved.expectedLines, resolved.user)
		assert.ok(Number.isSafeInteger(expected.total))
	}
})

test('J2 pools two distinct $39 eighth SKUs into the five-unit tier', () => {
	const plan = goldenPlans.find(plan => plan.id === 'J2')
	const samePriceCatalogue = catalogue.map(product => product.categoryIds.includes(331)
		? { ...product, unitPrice: '39.00' } : product)
	const resolved = resolvePlan(plan, samePriceCatalogue)
	const eighths = resolved.requests.filter(line => line.categoryIds.includes(331))
	assert.equal(eighths.length, 2)
	assert.notEqual(eighths[0].productId, eighths[1].productId)
	assert.deepEqual(eighths.map(line => [line.qty, line.unitPrice]), [[3, '39.00'], [2, '39.00']])
	const expected = expectedCart(resolved.expectedLines)
	assert.equal(expected.discountLines.length, 5)
	assert.equal(expected.discountLines.find(line => line.categoryId === 331).amount, 3500)
	assert.throws(() => resolvePlan(plan, samePriceCatalogue.filter(product =>
		!product.categoryIds.includes(331) || product.productId === eighths[0].productId)), /Inventory coverage gap/)
})

test('missing stock, BOGO category, and duplicate category membership are visible gaps', () => {
	assert.throws(() => resolvePlan(goldenPlans[0], []), /coverage gap/)
	assert.throws(() => resolvePlan(goldenPlans.at(-1), catalogue.filter(product => product.productId !== rules.bogo.productId)), /BOGO product unavailable/)
	assert.throws(() => resolvePlan(goldenPlans.at(-1), catalogue.map(product => product.productId === rules.bogo.productId ? { ...product, categoryIds: [123] } : product)), /J7 prerequisite/)
	assert.throws(() => coverageCarts([{...catalogue[0], categoryIds: [331, 323]}]), /multiple bulk categories/)
	assert.throws(() => coverageCarts([{...catalogue[0], categoryIds: [331], portionGrams: 14}]), /7g\/14g/)
})

test('J6 includes every supplied product/variation once per category', () => {
	const sweeps = coverageCarts(catalogue)
	assert.equal(sweeps.length, 5)
	assert.equal(sweeps.reduce((sum, sweep) => sum + sweep.requests.length, 0), catalogue.length)
	assert.ok(sweeps.flatMap(sweep => sweep.requests).every(line => line.qty === 1))
	assert.throws(() => coverageCarts(catalogue.map(product => ({ ...product, inStock: false }))), /coverage gap/)
})

test('mutation plans retain SKU identity and cover every intermediate state', () => {
	const products = [...catalogue, {productId: 99999, categoryIds: [999], unitPrice: '10.00', inStock: true}]
	const expectedDiscounts = {
		'single-sku-tier-change': [3500, 2000, 3500],
		'J1-cross-sku-removal': [1500, 3500, 1500, 0, 1500],
		'J3-account-recompute': [4400, 2900, 4400],
		'J7-paid-quantity': [900, 2400, 900],
		'non-eligible-addition': [1500, 1500],
		'same-category-sku-swap': [1500, 1500],
	}
	for (const sequence of mutationPlans()) {
		const resolved = sequence.steps.map(plan => resolvePlan(plan, products))
		assert.deepEqual(resolved.map(cart => expectedCart(cart.expectedLines, cart.user).bulkTotal), expectedDiscounts[sequence.id])
		if (sequence.id === 'same-category-sku-swap') assert.notEqual(resolved[0].requests[0].productId, resolved[1].requests[0].productId)
		if (sequence.id === 'J1-cross-sku-removal') assert.deepEqual(resolved[0].requests, resolved.at(-1).requests)
	}
})
