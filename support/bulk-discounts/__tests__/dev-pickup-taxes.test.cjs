const { test } = require('node:test')
const assert = require('node:assert/strict')
const rules = require('../rules.json')
const pickupTaxes = require('../dev-pickup-taxes.json')
const { expectedCart } = require('../oracle.cjs')
const liveRules = { ...rules, taxes: pickupTaxes.taxes, taxRounding: pickupTaxes.taxRounding }
const item = (categoryId, qty, unitPrice, productId = 1) => ({
	productId, categoryIds: [categoryId], qty, unitPrice, isFreeBogoUnit: false,
})

test('current dev pickup rates reproduce the observed undiscounted cart', () => {
	const result = expectedCart([item(323, 2, '60.00')], 'plain', liveRules)
	assert.deepEqual([result.subtotal, result.gross, result.excise, result.sales, result.total],
		[12000, 1320, 1998, 1455, 16773])
	// Importing the live profile must not change the workbook reference fixture.
	assert.deepEqual(rules.taxes.map(tax => tax.rateBasisPoints), [800, 1500, 775])
})

test('current dev taxes compound on the discounted J5 subtotal', () => {
	const result = expectedCart([item(331, 3, '39.00'), item(326, 3, '14.00', 2)], 'plain', liveRules)
	assert.deepEqual([result.subtotal, result.bulkTotal, result.discountedSubtotal], [15900, 2400, 13500])
	assert.deepEqual([result.gross, result.excise, result.sales, result.total], [1485, 2247, 1637, 18869])
})

test('per-line taxes match a second live cart after changing eighth quantity', () => {
	const result = expectedCart([item(331, 4, '39.00'), item(326, 3, '14.00', 2)], 'plain', liveRules)
	assert.deepEqual([result.subtotal, result.bulkTotal, result.discountedSubtotal], [19800, 2900, 16900])
	assert.deepEqual([result.gross, result.excise, result.sales, result.total], [1859, 2813, 2049, 23621])
})

test('line mode retains unrounded compound bases and rejects unverified account allocations', () => {
	const result = expectedCart([item(999, 1, '0.21')], 'plain', liveRules)
	assert.deepEqual([result.gross, result.excise, result.sales], [2, 3, 3])
	assert.throws(() => expectedCart([item(331, 3, '39.00')], 'vip', liveRules), /account discount allocation/)
	assert.throws(() => expectedCart([], 'plain', { ...liveRules, taxRounding: 'unknown' }), /Unsupported tax rounding/)
})
