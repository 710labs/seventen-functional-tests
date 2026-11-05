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
	if (!Array.isArray(taxLines) || !Array.isArray(configuredRates)) throw new Error('Missing store tax metadata')
	const normalize = name => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()
	const configuration = configuredRates.map(tax => {
		if (!normalize(tax.label) || typeof tax.compound !== 'boolean' || !Number.isSafeInteger(tax.priority) || tax.priority < 1 ||
			typeof tax.country !== 'string' || typeof tax.state !== 'string') throw new Error('Invalid store tax configuration')
		return { ...tax, country: tax.country.toLowerCase(), state: tax.state.toLowerCase(), rateBasisPoints: basisPoints(tax.rate) }
	})
	if (!taxLines.length && configuration.some(tax => tax.rateBasisPoints > 0)) {
		throw new Error('Cart returned no tax metadata; cannot establish its taxable jurisdiction')
	}
	const priorities = new Set()
	const labels = new Set()
	const selected = taxLines.map(tax => {
		const code = /^tax-rate-([a-z]{0,2})-([a-z]{0,2})-.+-(\d+)$/i.exec(tax.code || '')
		if (!code) throw new Error(`Missing or invalid cart tax jurisdiction code for ${tax.name}`)
		const [, country, state, priorityText] = code
		const priority = Number(priorityText)
		const name = normalize(tax.name)
		if (!name || labels.has(name) || priorities.has(priority)) throw new Error(`Duplicate cart tax label or priority: ${tax.name}`)
		labels.add(name)
		priorities.add(priority)
		if (typeof tax.rate !== 'string' || !tax.rate.trim().endsWith('%')) throw new Error(`Invalid cart tax percentage: ${tax.name}`)
		const rateBasisPoints = basisPoints(tax.rate.trim().slice(0, -1))
		const candidates = configuration.filter(config => config.country === country.toLowerCase() && config.state === state.toLowerCase() &&
			config.priority === priority && normalize(config.label) === name && config.rateBasisPoints === rateBasisPoints)
		if (!candidates.length) throw new Error(`No store tax configuration matches ${tax.code} (${tax.name}, ${tax.rate})`)
		return { key: `storeTax${priority}`, label: tax.name.trim(), rateBasisPoints, priority,
			country: country.toLowerCase(), state: state.toLowerCase(), compounds: [...new Set(candidates.map(config => config.compound))] }
	}).sort((a, b) => a.priority - b.priority)

	// Never accept a missing nonzero tax priority in an observed jurisdiction.
	// Different partner regions can use different labels/rates at the same priority.
	for (const config of configuration.filter(config => config.rateBasisPoints > 0 && selected.some(tax =>
		(!config.country || config.country === tax.country) && (!config.state || config.state === tax.state)))) {
		if (!priorities.has(config.priority)) throw new Error(`Missing configured tax priority ${config.priority}: ${config.label}`)
	}
	for (const [index, tax] of selected.entries()) {
		if (tax.compounds.length === 1) tax.compound = tax.compounds[0]
		else if (index === 0 && selected.slice(1).every(other => other.compounds.length === 1 && other.compounds[0])) {
			// A first tax has the same base either way when all remaining taxes compound.
			tax.compound = false
		} else throw new Error(`Ambiguous compound configuration for ${tax.label} at priority ${tax.priority}`)
	}
	const ordered = [...selected.filter(tax => !tax.compound), ...selected.filter(tax => tax.compound)]
	const result = structuredClone(rules)
	result.taxes = []
	for (const tax of ordered) {
		result.taxes.push({ key: tax.key, label: tax.label, rateBasisPoints: tax.rateBasisPoints,
			base: ['discountedSubtotal', ...(tax.compound ? result.taxes.map(previous => previous.key) : [])] })
	}
	return result
}

module.exports = { rulesWithCartTaxRates }
