const { test } = require('node:test')
const assert = require('node:assert/strict')
const { rulesForEnvironment } = require('../tax-profiles.cjs')
const { rulesWithCartTaxRates } = require('../cart-tax-rates.cjs')
const { expectedCart } = require('../oracle.cjs')
const rules = rulesForEnvironment('https://thelist-stage.710labs.com')
const metadata = gross => [
	{ name: 'Sales', rate: '9.5%', price: '999999' },
	{ name: 'County Gross Tax', rate: gross, price: '999999' },
	{ name: 'California Excise Tax', rate: '15%', price: '999999' },
]

test('store metadata changes rates without copying reported tax amounts or changing discounts', () => {
	const cart = [{ productId: 1, categoryIds: [331], unitPrice: '39.00', qty: 3, isFreeBogoUnit: false }]
	const march = rulesWithCartTaxRates(rules, metadata('8%'))
	const spaceflyt = rulesWithCartTaxRates(rules, metadata('10%'))
	assert.deepEqual(spaceflyt.bulkRules, rules.bulkRules)
	assert.equal(expectedCart(cart, 'plain', march).gross, 816)
	assert.equal(expectedCart(cart, 'plain', spaceflyt).gross, 1020)
	assert.deepEqual(expectedCart(cart, 'plain', march).discountLines, expectedCart(cart, 'plain', spaceflyt).discountLines)
	assert.equal(rules.taxes[0].rateBasisPoints, 800)
})

test('captured rates remain independent of later metadata mutation', () => {
	const input = metadata('10%')
	const selected = rulesWithCartTaxRates(rules, input)
	input[1].rate = '8%'
	assert.equal(selected.taxes[0].rateBasisPoints, 1000)
})

test('missing, duplicated, unknown, or invalid rates fail instead of assuming an environment default', () => {
	for (const input of [undefined, [], metadata('10%').slice(1), metadata('-1%'), metadata('101%'), metadata('9.555%'), metadata('NaN'),
		[...metadata('10%').slice(0, 2), { name: 'Gross', rate: '15%' }],
		[...metadata('10%').slice(0, 2), { name: 'Unknown', rate: '15%' }]]) {
		assert.throws(() => rulesWithCartTaxRates(rules, input))
	}
})

const line = [{ productId: 1, categoryIds: [331], unitPrice: '39.00', qty: 3, isFreeBogoUnit: false }]
test('state taxes support fractional rates and independently computed regular and compound amounts', () => {
	const selected = rulesWithCartTaxRates(rules, [
		{ name: 'Sales', rate: '6.625%', price: '999999' },
		{ name: 'Local', rate: '2%', price: '999999' },
		{ name: 'Excise', rate: '10%', price: '999999' },
	], [
		{ label: 'Excise', rate: 10, compound: 'yes' },
		{ label: 'Sales', rate: 6.625, compound: 'no' },
		{ label: 'Local', rate: 2, compound: 'no' },
	])
	const pricing = expectedCart(line, 'plain', selected)
	assert.deepEqual(pricing.taxLines, [
		{ label: 'Sales', amount: 676 }, { label: 'Local', amount: 204 }, { label: 'Excise', amount: 1108 },
	])
	assert.equal(pricing.total, 12188)
})

test('tax-free configuration accepts no rows but never hides a missing nonzero configured tax', () => {
	assert.deepEqual(expectedCart(line, 'plain', rulesWithCartTaxRates(rules, [], [])).taxLines, [])
	assert.equal(expectedCart(line, 'plain', rulesWithCartTaxRates(rules, [], [])).total, 10200)
	assert.deepEqual(rulesWithCartTaxRates(rules, [], [{ label: 'Sales', rate: 0, compound: 'no' }]).taxes, [])
	assert.throws(() => rulesWithCartTaxRates(rules, [], [{ label: 'Sales', rate: 6, compound: 'no' }]), /Missing configured tax/)
})

test('state metadata rejects ambiguous labels, missing compound configuration and invalid precision', () => {
	for (const config of [
		[{ label: 'Sales', rate: 6 }],
		[{ label: 'Sales', rate: 6, compound: 'maybe' }],
		[{ label: 'Sales', rate: 6.12345, compound: 'no' }],
		[{ label: 'Sales', rate: -1, compound: 'no' }],
		[{ label: 'Sales', rate: 6, compound: 'no' }, { label: 'sales', rate: 2, compound: 'yes' }],
	]) assert.throws(() => rulesWithCartTaxRates(rules, [{ name: 'Sales', rate: '6%' }], config))
	assert.throws(() => rulesWithCartTaxRates(rules, [{ name: 'Unknown', rate: '6%' }], []))
})
