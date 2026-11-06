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
const config = (label, rate, priority, compound = true, state = 'MI') => ({ country: 'US', state, label, rate: String(rate), priority, compound })
const tax = (name, rate, priority, state = 'mi') => ({ name, rate: `${rate}%`, code: `tax-rate-us-${state}-${name.toLowerCase().replaceAll(' ', '-')}-${priority}`, price: '999999' })
const miConfig = [config('County Gross Tax', 10, 1, true, 'CA'), config('California Excise Tax', 15, 2, true, 'CA'),
	config('Sales', 9.5, 3, true, 'CA'), config('Excise Tax', 10, 1), config('Sales Tax', 6, 2)]
const miMetadata = [tax('Sales Tax', 6, 2), tax('Excise Tax', 10, 1)]

test('MI fulfillment taxes ignore unrelated CA configuration and compound in priority order', () => {
	const input = structuredClone(miConfig)
	const selected = rulesWithCartTaxRates(rules, miMetadata, input)
	const pricing = expectedCart(line, 'plain', selected)
	assert.deepEqual(pricing.taxLines, [{ label: 'Excise Tax', amount: 1020 }, { label: 'Sales Tax', amount: 673 }])
	assert.equal(pricing.total, 11893)
	assert.deepEqual(input, miConfig)
	assert.deepEqual(selected.bulkRules, rules.bulkRules)
	input[3].rate = '20'
	assert.equal(selected.taxes[0].rateBasisPoints, 1000)
})

test('observed MI two-unit cart is calculated independently of reported amounts', () => {
	const pricing = expectedCart([{ ...line[0], qty: 2, unitPrice: '60.00' }], 'plain', rulesWithCartTaxRates(rules, miMetadata, miConfig))
	assert.deepEqual(pricing.taxLines, [{ label: 'Excise Tax', amount: 1200 }, { label: 'Sales Tax', amount: 792 }])
	assert.equal(pricing.total, 13992)
})

test('fractional regular taxes precede compound taxes, regardless of metadata order', () => {
	const selected = rulesWithCartTaxRates(rules, [tax('Sales', 6.625, 2), tax('Local', 2, 3), tax('Excise', 10, 1)],
		[config('Excise', 10, 1), config('Sales', 6.625, 2, false), config('Local', 2, 3, false)])
	const pricing = expectedCart(line, 'plain', selected)
	assert.deepEqual(pricing.taxLines, [
		{ label: 'Sales', amount: 676 }, { label: 'Local', amount: 204 }, { label: 'Excise', amount: 1108 },
	])
	assert.equal(pricing.total, 12188)
})

test('tax-free configuration accepts no rows but missing taxable metadata fails', () => {
	assert.equal(expectedCart(line, 'plain', rulesWithCartTaxRates(rules, [], [])).total, 10200)
	assert.deepEqual(rulesWithCartTaxRates(rules, [], [config('Sales', 0, 1, false)]).taxes, [])
	assert.throws(() => rulesWithCartTaxRates(rules, [], miConfig), /no tax metadata/)
	assert.throws(() => rulesWithCartTaxRates(rules, [miMetadata[1]], miConfig), /Missing configured tax priority 2/)
})

test('metadata must match configured jurisdiction, priority, label and rate', () => {
	for (const changes of [{ code: undefined }, { code: 'tax-rate-us-co-excise-tax-1' }, { code: 'tax-rate-us-mi-excise-tax-3' },
		{ name: 'Unknown' }, { rate: '11%' }, { rate: '6.12345%' }]) {
		assert.throws(() => rulesWithCartTaxRates(rules, [miMetadata[0], { ...miMetadata[1], ...changes }], miConfig))
	}
	assert.throws(() => rulesWithCartTaxRates(rules, [...miMetadata, miMetadata[0]], miConfig), /Duplicate/)
})

test('configuration rejects invalid rates, priorities and compound flags', () => {
	for (const changes of [{ compound: undefined }, { compound: 'yes' }, { rate: '6.12345' }, { rate: '-1' }, { priority: 0 }]) {
		assert.throws(() => rulesWithCartTaxRates(rules, miMetadata, [ ...miConfig.slice(0, -1), { ...miConfig.at(-1), ...changes } ]))
	}
})

test('equivalent regional configurations are accepted; ambiguous compounding fails', () => {
	const selected = rulesWithCartTaxRates(rules, miMetadata, [...miConfig, config('Excise Tax', 10, 1, false)])
	assert.equal(expectedCart(line, 'plain', selected).total, 11893)
	assert.throws(() => rulesWithCartTaxRates(rules, miMetadata, [...miConfig, config('Sales Tax', 6, 2, false)]), /Ambiguous compound/)
})

test('wildcard state tax codes match wildcard configuration without borrowing CA taxes', () => {
	const selected = rulesWithCartTaxRates(rules, [tax('Excise Tax', 10, 1), tax('Sales Tax', 6, 2, '')],
		[...miConfig.slice(0, -1), config('Sales Tax', 6, 2, true, '')])
	assert.equal(expectedCart(line, 'plain', selected).total, 11893)
})

test('an empty tax list is valid only when the independently selected fulfillment jurisdiction has no configured tax', () => {
	const selected = rulesWithCartTaxRates(rules, [], miConfig, { country: 'US', state: 'NJ' })
	assert.equal(expectedCart(line, 'plain', selected).total, 10200)
	assert.deepEqual(selected.taxes, [])
	for (const state of ['MI', 'CA']) assert.throws(() => rulesWithCartTaxRates(rules, [], miConfig, { country: 'US', state }), /Missing configured taxes/)
	assert.throws(() => rulesWithCartTaxRates(rules, [], miConfig, { country: 'US', state: '' }), /cannot establish/)
	assert.throws(() => rulesWithCartTaxRates(rules, [], [...miConfig, config('Sales', 6, 1, false, '')], { country: 'US', state: 'NJ' }), /Missing configured taxes/)
})
