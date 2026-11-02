const { test } = require('node:test')
const assert = require('node:assert/strict')
const rules = require('../rules.json')
const { cents, percentage, expectedCart } = require('../oracle.cjs')

const item = (categoryId, qty, unitPrice = '39.00', productId = 1) => ({
	productId, categoryIds: [categoryId], qty, unitPrice, isFreeBogoUnit: false,
})

test('J0: workbook screenshot baseline, including each rounded compound tax', () => {
	const result = expectedCart([item(331, 3), item(331, 3, '39.00', 2)])
	assert.equal(result.subtotal, 23400)
	assert.equal(result.bulkTotal, 4200)
	assert.equal(result.discountedSubtotal, 19200)
	assert.equal(result.gross, 1536)
	assert.equal(result.excise, 3110)
	assert.equal(result.sales, 1848)
	assert.equal(result.total, 25694)
	assert.deepEqual(result.discountLines, [{kind: 'bulk', ruleId: 24, categoryId: 331, label: 'Eighths 5+', amount: 4200}])
})

// Independent expected amounts detect a changed/wrong fixture as well as a bad oracle.
for (const [categoryId, expected] of [
	[331, [0, 1500, 2000, 3500, 4200]],
	[323, [0, 1500, 2000, 3500, 4200]],
	[327, [0, 1500, 2000, 3500, 4200]],
	[324, [0, 900, 1200, 2500, 3000]],
	[326, [0, 900, 1200, 2500, 3000]],
]) {
	for (const [index, qty] of [2, 3, 4, 5, 6].entries()) {
		test(`category ${categoryId}, threshold quantity ${qty}`, () => {
			const result = expectedCart([item(categoryId, qty)])
			assert.equal(result.bulkTotal, expected[index])
			assert.equal(result.perCategoryQty[categoryId], qty)
			assert.equal(result.discountLines.length, qty < 3 ? 0 : 1)
			if (qty >= 3) assert.ok(result.discountLines[0].label.endsWith(qty >= 5 ? '5+' : '3+'))
		})
	}
}

test('J1: cross-SKU count with below-threshold categories unchanged', () => {
	const result = expectedCart([item(331, 2), item(331, 1, '39.00', 2), item(323, 2, '55.00', 3), item(324, 1, '25.00', 4)])
	assert.equal(result.subtotal, 25200)
	assert.equal(result.bulkTotal, 1500)
	assert.equal(result.discountLines.length, 1)
	assert.equal(result.discountLines[0].categoryId, 331)
})

test('J2: five independent category lines with two $39 eighth SKUs', () => {
	const result = expectedCart([item(331, 3), item(331, 2, '39.00', 2), item(323, 5, '55.00', 3), item(327, 3, '60.00', 4), item(324, 5, '25.00', 5), item(326, 3, '20.00', 6)])
	assert.equal(result.bulkTotal, 11900)
	assert.equal(result.discountLines.length, 5)
	assert.equal(result.discountLines.find(line => line.categoryId === 331).amount, 3500)
	// The oracle intentionally makes no per-line allocation assertion.
	assert.equal(result.subtotal, 83500)
})

test('provided cart labels and coupon keys identify badder and vapes separately', () => {
	const result = expectedCart([item(327, 3, '57.00'), item(323, 5, '54.00', 2)])
	assert.deepEqual(result.discountLines.map(({ label, couponKey, amount }) => ({ label, couponKey, amount })), [
		{ label: 'Live Rosin Vapes 5+', couponKey: 'live-rosin-vapes-bulk-discount', amount: 3500 },
		{ label: 'Live Rosin Badder 3+', couponKey: 'live-rosin', amount: 1500 },
	])
	assert.equal(result.total, 52326)
})

test('J3: percentage after bulk, with 5 → 4 → 5 recomputation', () => {
	for (const [qty, account, bulk] of [[5, 3390, 4400], [4, 3030, 2900], [5, 3390, 4400]]) {
		const result = expectedCart([item(331, qty), item(324, 3, '25.00', 2)], 'vip')
		assert.equal(result.accountTotal, account)
		assert.equal(result.bulkTotal, bulk)
		assert.equal(result.discountLines.length, 3)
	}
})

test('J4: only one tier survives 4 → 5 → 4', () => {
	for (const [qty, discount, label] of [[4, 2000, 'Eighths 3+'], [5, 3500, 'Eighths 5+'], [4, 2000, 'Eighths 3+']]) {
		const result = expectedCart([item(331, qty)])
		assert.deepEqual(result.discountLines.map(line => [line.amount, line.label]), [[discount, label]])
	}
})

test('J5: plain user eighths + doinks; no account discount inferred', () => {
	const result = expectedCart([item(331, 3), item(326, 3, '20.00', 2)])
	assert.equal(result.bulkTotal, 2400)
	assert.equal(result.accountTotal, 0)
})

test('J6: category quantities never pool across categories', () => {
	assert.equal(expectedCart(rules.bulkRules.map((rule, i) => item(rule.categoryId, 1, '39.00', i + 1))).bulkTotal, 0)
})

test('J7: free units excluded through 2 → 3 → 2 PAID eighths', () => {
	const bogoPaid = item(331, 1, '39.00', rules.bogo.productId)
	const free = { ...bogoPaid, qty: 2, unitPrice: '0.00', isFreeBogoUnit: true }
	for (const [qty, expectedBulk, paid] of [[1, 900, 2], [2, 2400, 3], [1, 900, 2]]) {
		const result = expectedCart([bogoPaid, free, item(331, qty), item(324, 3, '25.00', 2)])
		assert.equal(result.bulkTotal, expectedBulk)
		assert.equal(result.perCategoryQty[331], paid)
		assert.equal(result.subtotal, paid * 3900 + 7500)
	}
})

test('empty carts have no discounts or taxes for either user', () => {
	for (const user of ['plain', 'vip']) {
		const result = expectedCart([], user)
		assert.equal(result.total, 0)
		assert.deepEqual(result.discountLines, [])
	}
})

test('non-eligible category has no bulk discount but retains tax and account eligibility', () => {
	const result = expectedCart([item(999, 3, '10.00')], 'vip')
	assert.equal(result.bulkTotal, 0)
	assert.equal(result.accountTotal, 450)
	assert.ok(result.total > result.discountedSubtotal)
})

test('mixed-price cents and positive half-cent account rounding are exact', () => {
	assert.equal(cents('19.99'), 1999)
	assert.equal(cents('0.01'), 1)
	assert.equal(percentage(10, 1500), 2)
	assert.equal(expectedCart([item(331, 2, '39.99'), item(331, 1, '45.01', 2)], 'vip').accountTotal, 1650)
})

test('fixture edits flow through discounts, labels, account percentage and tax bases', () => {
	const custom = structuredClone(rules)
	custom.bulkRules.find(rule => rule.categoryId === 331).tiers[1].amountPerUnit = '8.00'
	custom.bulkRules.find(rule => rule.categoryId === 331).expectedLabelTemplate = 'Flower {min}+'
	custom.accountDiscounts.vip.rateBasisPoints = 2000
	custom.taxes[0].rateBasisPoints = 1000
	custom.taxes[1].base = ['discountedSubtotal']
	const result = expectedCart([item(331, 5, '40.00')], 'vip', custom)
	assert.equal(result.bulkTotal, 4000)
	assert.equal(result.discountLines[0].label, 'Flower 5+')
	assert.equal(result.accountTotal, 3200)
	assert.equal(result.gross, 1280)
	assert.equal(result.excise, 1920)
})

test('export upper bound 999 is honored; not silently treated as unlimited', () => {
	assert.equal(expectedCart([item(331, 999)]).bulkTotal, 699300)
	assert.equal(expectedCart([item(331, 1000)]).bulkTotal, 0)
})

test('invalid and ambiguous inputs fail rather than creating plausible totals', () => {
	for (const value of ['1.001', '-1.00', '', 'NaN', Infinity, '1e2', Number.MAX_SAFE_INTEGER]) assert.throws(() => cents(value))
	for (const qty of [-1, 1.5, NaN, Infinity]) assert.throws(() => expectedCart([item(331, qty)]))
	assert.throws(() => expectedCart([item(331, 3)], 'unknown'), /Unknown account/)
	assert.throws(() => expectedCart([{ ...item(331, 3), categoryIds: [331, 323] }]), /multiple bulk categories/)
	assert.throws(() => expectedCart([{ ...item(331, 3), isFreeBogoUnit: true }]), /Invalid free/)
	assert.throws(() => expectedCart([item(331, 3, '1.00')]), /exceeds eligible/)
	const overlapping = structuredClone(rules)
	overlapping.bulkRules[0].tiers[1].min = 4
	assert.throws(() => expectedCart([], 'plain', overlapping), /overlapping tiers/)
	const badTax = structuredClone(rules)
	badTax.taxes[0].base.push('sales')
	assert.throws(() => expectedCart([], 'plain', badTax), /tax dependency/)
})

test('oracle does not mutate callers or the rule fixture', () => {
	const cart = [item(331, 5)]
	const originalCart = structuredClone(cart)
	const originalRules = structuredClone(rules)
	expectedCart(cart, 'vip')
	assert.deepEqual(cart, originalCart)
	assert.deepEqual(rules, originalRules)
})
