const defaultRules = require('./rules.json')

// Prices enter as decimal dollars; all calculations and results use integer cents.
function cents(value) {
	const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(value))
	if (!match) throw new Error('Price must be a nonnegative decimal with at most two places')
	const result = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'))
	if (!Number.isSafeInteger(result)) throw new Error('Price exceeds safe integer range')
	return result
}

function integer(value, name) {
	if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${name}`)
	return value
}

function percentage(amount, basisPoints) {
	integer(amount, 'percentage base')
	integer(basisPoints, 'basis points')
	if (basisPoints > 10000) throw new Error('Rate exceeds 100%')
	// Positive half-up rounding, matching ROUND(..., 2) in the workbook.
	const rounded = Number((BigInt(amount) * BigInt(basisPoints) + 5000n) / 10000n)
	return integer(rounded, 'percentage result')
}

function validateRules(rules) {
	if (rules.currency !== 'USD' || rules.minorUnit !== 2) throw new Error('Unsupported currency')
	const categories = new Set()
	const ruleIds = new Set()
	for (const rule of rules.bulkRules) {
		integer(rule.id, 'rule id')
		integer(rule.categoryId, 'category id')
		if (categories.has(rule.categoryId) || ruleIds.has(rule.id)) throw new Error('Duplicate bulk rule')
		categories.add(rule.categoryId)
		ruleIds.add(rule.id)
		if (rule.operator !== 'product_cumulative' || rule.type !== 'flat' || !rule.applyAsCartRule) {
			throw new Error('Unsupported bulk rule semantics')
		}
		if (!rule.expectedLabelTemplate?.includes('{min}')) throw new Error('Missing tier label template')
		let previousMax = 0
		for (const tier of rule.tiers) {
			integer(tier.min, 'tier minimum')
			integer(tier.max, 'tier maximum')
			if (tier.min <= previousMax || tier.max < tier.min) throw new Error('Invalid or overlapping tiers')
			if (cents(tier.amountPerUnit) === 0) throw new Error('Zero bulk tier')
			previousMax = tier.max
		}
	}
	if (rules.bogo.countFreeUnits !== false) throw new Error('Free BOGO units must be excluded')
	const knownBases = new Set(['discountedSubtotal'])
	for (const tax of rules.taxes) {
		if (knownBases.has(tax.key) || !tax.base.length || new Set(tax.base).size !== tax.base.length ||
			tax.base.some(base => !knownBases.has(base))) throw new Error('Invalid tax dependency')
		percentage(0, tax.rateBasisPoints)
		knownBases.add(tax.key)
	}
}

function expectedCart(cart, user = 'plain', rules = defaultRules) {
	validateRules(rules)
	if (!Object.hasOwn(rules.accountDiscounts, user)) throw new Error('Unknown account discount profile')
	const perCategoryQty = Object.fromEntries(rules.bulkRules.map(rule => [rule.categoryId, 0]))
	const categorySubtotals = { ...perCategoryQty }
	let subtotal = 0
	for (const line of cart) {
		integer(line.productId, 'product id')
		integer(line.qty, 'quantity')
		if (!Array.isArray(line.categoryIds) || line.categoryIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
			throw new Error('Invalid category IDs')
		}
		if (typeof line.isFreeBogoUnit !== 'boolean') throw new Error('Explicit BOGO classification required')
		const price = cents(line.unitPrice)
		const categories = rules.bulkRules.filter(rule => line.categoryIds.includes(rule.categoryId))
		if (categories.length > 1) throw new Error(`Product ${line.productId} belongs to multiple bulk categories`)
		if (line.isFreeBogoUnit) {
			if (line.productId !== rules.bogo.productId || price !== 0) throw new Error('Invalid free BOGO line')
			continue
		}
		const lineSubtotal = integer(line.qty * price, 'line subtotal')
		subtotal = integer(subtotal + lineSubtotal, 'subtotal')
		for (const rule of categories) {
			perCategoryQty[rule.categoryId] = integer(perCategoryQty[rule.categoryId] + line.qty, 'category quantity')
			categorySubtotals[rule.categoryId] = integer(categorySubtotals[rule.categoryId] + lineSubtotal, 'category subtotal')
		}
	}

	const discountLines = []
	for (const rule of rules.bulkRules) {
		const qty = perCategoryQty[rule.categoryId]
		const tier = rule.tiers.find(tier => qty >= tier.min && qty <= tier.max)
		if (!tier) continue
		const amount = integer(qty * cents(tier.amountPerUnit), 'bulk discount')
		// Do not guess Flycart's cap behavior on below-discount inventory prices.
		if (amount > categorySubtotals[rule.categoryId]) throw new Error('Bulk discount exceeds eligible subtotal')
		discountLines.push({
			kind: 'bulk', ruleId: rule.id, categoryId: rule.categoryId,
			label: rule.expectedLabelTemplate.replace('{min}', String(tier.min)), amount,
			...(rule.couponKey ? { couponKey: rule.couponKey } : {}),
		})
	}
	const bulkTotal = discountLines.reduce((sum, line) => sum + line.amount, 0)
	const accountRule = rules.accountDiscounts[user]
	if (accountRule && accountRule.base !== 'afterBulk') throw new Error('Account discount must follow bulk')
	const accountTotal = accountRule ? percentage(subtotal - bulkTotal, accountRule.rateBasisPoints) : 0
	if (accountTotal) discountLines.push({ kind: 'account', ruleId: accountRule.id, label: accountRule.label, amount: accountTotal })
	const discountedSubtotal = subtotal - bulkTotal - accountTotal
	const bases = { discountedSubtotal }
	const taxes = {}
	for (const tax of rules.taxes) {
		const amount = percentage(tax.base.reduce((sum, key) => sum + bases[key], 0), tax.rateBasisPoints)
		taxes[tax.key] = amount
		bases[tax.key] = amount
	}
	return {
		subtotal, discountLines, bulkTotal, accountTotal, discountedSubtotal, ...taxes,
		total: integer(discountedSubtotal + Object.values(taxes).reduce((sum, amount) => sum + amount, 0), 'total'),
		perCategoryQty,
	}
}

module.exports = { cents, percentage, validateRules, expectedCart }
