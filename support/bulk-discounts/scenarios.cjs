const defaultRules = require('./rules.json')
const { cents } = require('./oracle.cjs')

class ScenarioInventoryUnavailableError extends Error {}

const quantities = [0, 1, 2, 3, 4, 5, 6, 10]
const line = (categoryId, skuIndex, qty, extra = {}) => ({ categoryId, skuIndex, qty, ...extra })

// Prices/SKUs are discovered at runtime. Final workbook carts with user-approved
// J2 adjustment: distinct eighth SKUs may both cost $39.
// J6 is a catalogue sweep, generated separately, rather than a fixed cart.
const goldenPlans = [
	{ id: 'J0', user: 'plain', lines: [line(331, 0, 3), line(331, 1, 3)] },
	{ id: 'J1', user: 'plain', lines: [line(331, 0, 2), line(331, 1, 1), line(323, 0, 2), line(324, 0, 1)] },
	{ id: 'J2', user: 'plain', lines: [line(331, 0, 3), line(331, 1, 2), line(323, 0, 5), line(327, 0, 3), line(324, 0, 5), line(326, 0, 3)] },
	{ id: 'J3', user: 'vip', lines: [line(331, 0, 5), line(324, 0, 3)] },
	{ id: 'J4', user: 'plain', lines: [line(331, 0, 2), line(331, 1, 2)] },
	{ id: 'J5', user: 'plain', lines: [line(331, 0, 3), line(326, 0, 3)] },
	{ id: 'J7', user: 'plain', bogo: true, lines: [line(331, 0, 1), line(324, 0, 3)] },
]

function randomGenerator(seed) {
	if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32')
	let state = seed
	return () => {
		state = (state + 0x6d2b79f5) | 0
		let value = Math.imul(state ^ (state >>> 15), 1 | state)
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296
	}
}

function samplePlans({ seed = 710, count = 200, rules = defaultRules } = {}) {
	if (!Number.isSafeInteger(count) || count < goldenPlans.length) throw new Error('Count must include every golden cart')
	const random = randomGenerator(seed)
	const pick = values => values[Math.floor(random() * values.length)]
	const plans = structuredClone(goldenPlans)
	while (plans.length < count) {
		const index = plans.length - goldenPlans.length
		const lines = []
		for (const rule of rules.bulkRules) {
			const qty = pick(quantities)
			if (!qty) continue
			const slots = Math.min(qty, pick([1, 2, 3]))
			const split = Array(slots).fill(1)
			for (let remaining = qty - slots; remaining > 0; remaining--) split[pick([...split.keys()])]++
			split.forEach((quantity, skuIndex) => lines.push(line(rule.categoryId, skuIndex, quantity)))
		}
		plans.push({ id: `sample-${seed}-${index}`, user: index % 2 ? 'vip' : 'plain', bogo: index % 4 >= 2, lines })
	}
	return plans
}

function validateCatalogue(catalogue, rules = defaultRules) {
	const seen = new Set()
	for (const product of catalogue) {
		if (!Number.isSafeInteger(product.productId) || product.productId <= 0 || seen.has(product.productId)) {
			throw new Error('Missing or duplicate catalogue product ID')
		}
		seen.add(product.productId)
		if (!Array.isArray(product.categoryIds)) throw new Error('Missing catalogue category membership')
		const eligible = rules.bulkRules.filter(rule => product.categoryIds.includes(rule.categoryId))
		if (eligible.length > 1) throw new Error(`Product ${product.productId} belongs to multiple bulk categories`)
		if ([7, 14].includes(product.portionGrams) && eligible.some(rule => rule.categoryId === 331)) {
			throw new Error(`Product ${product.productId}: 7g/14g flower in eighths category`)
		}
		cents(product.unitPrice)
	}
}

function resolvePlan(plan, catalogue, rules = defaultRules) {
	validateCatalogue(catalogue, rules)
	const chosen = new Map()
	const requests = plan.lines.map(request => {
		const key = `${request.categoryId}:${request.skuIndex}`
		if (chosen.has(key)) throw new Error('Duplicate scenario slot')
		const candidates = catalogue.filter(product => (request.categoryId === null
			? !rules.bulkRules.some(rule => product.categoryIds.includes(rule.categoryId))
			: product.categoryIds.includes(request.categoryId)) &&
			product.productId !== rules.bogo.productId && product.inStock !== false)
			.sort((a, b) => cents(a.unitPrice) - cents(b.unitPrice) || a.productId - b.productId)
		const used = new Set([...chosen.values()].map(product => product.productId))
		// Stable SKU slots preserve distinct products even when every price is equal.
		const product = candidates[request.skuIndex]
		if (!product) {
			const prices = [...new Set(candidates.map(candidate => cents(candidate.unitPrice)))].map(price => `$${(price / 100).toFixed(2)}`)
			throw new ScenarioInventoryUnavailableError(`Inventory coverage gap for category ${request.categoryId}, slot ${request.skuIndex} (${plan.id}): ` +
				`${candidates.length} eligible products; available unit prices: ${prices.join(', ') || 'none'}.`)
		}
		if (used.has(product.productId)) throw new Error('Scenario slots must resolve to distinct products')
		chosen.set(key, product)
		return { productId: product.productId, categoryIds: [...product.categoryIds], unitPrice: product.unitPrice, qty: request.qty, isFreeBogoUnit: false }
	})
	if (plan.bogo) {
		const product = catalogue.find(product => product.productId === rules.bogo.productId && product.inStock !== false)
		if (!product) throw new Error('BOGO product unavailable')
		// J7 explicitly exercises BOGO within Eighths; do not silently weaken it.
		if (!product.categoryIds.includes(331)) throw new Error('J7 prerequisite: verify BOGO product belongs to Eighths')
		requests.push({ productId: product.productId, categoryIds: [...product.categoryIds], unitPrice: product.unitPrice, qty: 1, isFreeBogoUnit: false })
	}
	const freeLines = plan.bogo ? [{
		productId: rules.bogo.productId,
		categoryIds: [...catalogue.find(product => product.productId === rules.bogo.productId).categoryIds],
		unitPrice: '0.00', qty: rules.bogo.freeQty, isFreeBogoUnit: true,
	}] : []
	return { id: plan.id, user: plan.user, requests, expectedLines: [...requests, ...freeLines] }
}

function coverageCarts(catalogue, rules = defaultRules) {
	validateCatalogue(catalogue, rules)
	const toLine = product => ({ productId: product.productId, categoryIds: [...product.categoryIds], unitPrice: product.unitPrice, qty: 1, isFreeBogoUnit: false })
	return rules.bulkRules.map(rule => {
		const products = catalogue.filter(product => product.categoryIds.includes(rule.categoryId))
		if (!products.length || products.some(product => product.inStock === false)) {
			throw new Error(`J6 inventory coverage gap for category ${rule.categoryId}`)
		}
		// Includes all supplied variants. A catalogue loader must expand variable products.
		return { id: `J6-${rule.categoryId}`, user: 'plain', requests: products.map(toLine) }
	})
}

function mutationPlans() {
	const plan = (id, lines, user = 'plain', bogo = false) => ({ id, user, bogo, lines })
	return [
		{ id: 'single-sku-tier-change', steps: [5, 4, 5].map((qty, i) => plan(`single-${i}`, [line(331, 0, qty)])) },
		{ id: 'J1-cross-sku-removal', steps: [1, 3, 1, 0, 1].map((qty, i) => plan(`J1-${i}`, [line(331, 0, 2), ...(qty ? [line(331, 1, qty)] : []), line(323, 0, 2), line(324, 0, 1)])) },
		{ id: 'J3-account-recompute', steps: [5, 4, 5].map((qty, i) => plan(`J3-${i}`, [line(331, 0, qty), line(324, 0, 3)], 'vip')) },
		{ id: 'J7-paid-quantity', steps: [1, 2, 1].map((qty, i) => plan(`J7-${i}`, [line(331, 0, qty), line(324, 0, 3)], 'plain', true)) },
		{ id: 'non-eligible-addition', steps: [
			plan('non-eligible-before', [line(331, 0, 3)]),
			plan('non-eligible-after', [line(331, 0, 3), line(null, 0, 1)]),
		] },
		{ id: 'same-category-sku-swap', steps: [
			plan('sku-swap-before', [line(331, 0, 3)]),
			plan('sku-swap-after', [line(331, 1, 3)]),
		] },
	]
}

module.exports = { quantities, goldenPlans, samplePlans, validateCatalogue, resolvePlan, coverageCarts, mutationPlans, ScenarioInventoryUnavailableError }
