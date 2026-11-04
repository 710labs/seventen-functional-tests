// Read configured percentage metadata only. Discount bases, tax amounts, and totals
// are still calculated independently by the oracle and checked against the UI.
function rulesWithCartTaxRates(rules, taxLines, configuredRates) {
	if (configuredRates !== undefined) return rulesWithConfiguredTaxes(rules, taxLines, configuredRates)
	if (!Array.isArray(taxLines) || taxLines.length !== rules.taxes.length) {
		throw new Error('Expected configured gross, excise, and sales tax rates for the selected store')
	}
	const rates = new Map()
	for (const line of taxLines) {
		const keys = rules.taxes.filter(tax => new RegExp(`\\b${tax.key}\\b`, 'i').test(line.name || ''))
		const match = /^(\d{1,3})(?:\.(\d{1,2}))?%$/.exec(String(line.rate).trim())
		if (keys.length !== 1 || !match) throw new Error('Unrecognized store tax label or percentage')
		const rate = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'))
		if (rate > 10000 || rates.has(keys[0].key)) throw new Error('Invalid or duplicate store tax rate')
		rates.set(keys[0].key, rate)
	}
	const result = structuredClone(rules)
	for (const tax of result.taxes) {
		if (!rates.has(tax.key)) throw new Error(`Missing store tax rate: ${tax.key}`)
		tax.rateBasisPoints = rates.get(tax.key)
	}
	return result
}

function basisPoints(value) {
	const match = /^(\d{1,3})(?:\.(\d{1,4}))?$/.exec(String(value))
	if (!match || Number(value) > 100) throw new Error('Invalid configured tax percentage')
	return (Number(match[1]) * 10000 + Number((match[2] || '').padEnd(4, '0'))) / 100
}

function rulesWithConfiguredTaxes(rules, taxLines, configuredRates) {
	if (!Array.isArray(taxLines) || !Array.isArray(configuredRates)) throw new Error('Missing state tax metadata')
	const normalize = name => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
	const names = new Set()
	const configured = configuredRates.map((tax, index) => {
		const name = normalize(tax.label)
		if (!name || names.has(name) || !['yes', 'no'].includes(tax.compound)) throw new Error('Ambiguous configured tax label or compound flag')
		names.add(name)
		return { ...tax, name, key: `storeTax${index}`, rateBasisPoints: basisPoints(tax.rate) }
	})
	const observed = new Map()
	for (const tax of taxLines) {
		const name = normalize(tax.name)
		if (observed.has(name) || !names.has(name) || typeof tax.rate !== 'string' || !tax.rate.endsWith('%')) {
			throw new Error('Unrecognized or duplicate cart tax metadata')
		}
		observed.set(name, { label: tax.name.trim(), rateBasisPoints: basisPoints(tax.rate.slice(0, -1)) })
	}
	for (const tax of configured) {
		if (tax.rateBasisPoints > 0 && !observed.has(tax.name)) throw new Error(`Missing configured tax in cart: ${tax.label}`)
	}
	// WooCommerce calculates regular taxes first, then compound taxes in configured
	// order. Only configuration is read; the oracle still computes every amount.
	// https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/includes/class-wc-tax.php
	const ordered = [...configured.filter(tax => tax.compound === 'no'), ...configured.filter(tax => tax.compound === 'yes')]
	const result = structuredClone(rules)
	result.taxes = []
	for (const tax of ordered) {
		if (!observed.has(tax.name)) continue // Absent zero-rate rows are valid.
		result.taxes.push({ key: tax.key, ...observed.get(tax.name),
			base: ['discountedSubtotal', ...(tax.compound === 'yes' ? result.taxes.map(previous => previous.key) : [])] })
	}
	return result
}

module.exports = { rulesWithCartTaxRates }
