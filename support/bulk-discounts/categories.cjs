function bindCategoryIds(rules, categoryIdsBySlug, { allowMissing = false } = {}) {
	const result = structuredClone(rules)
	if (allowMissing) result.bulkRules = result.bulkRules.filter(rule => Object.hasOwn(categoryIdsBySlug, rule.categorySlug))
	const used = new Set()
	for (const rule of result.bulkRules) {
		const id = categoryIdsBySlug[rule.categorySlug]
		if (!Number.isSafeInteger(id) || id <= 0 || used.has(id)) {
			throw new Error(`Missing or ambiguous bulk category: ${rule.categorySlug}`)
		}
		used.add(id)
		rule.categoryId = id
	}
	return result
}

function remapPlanCategories(plan, referenceRules, liveRules) {
	const ids = new Map(referenceRules.bulkRules.map(rule => [rule.categoryId,
		liveRules.bulkRules.find(live => live.categorySlug === rule.categorySlug)?.categoryId]))
	return { ...structuredClone(plan), lines: plan.lines.map(line => {
		if (line.categoryId === null) return { ...line }
		const categoryId = ids.get(line.categoryId)
		if (!categoryId) throw new Error(`Unmapped scenario category: ${line.categoryId}`)
		return { ...line, categoryId }
	}) }
}

module.exports = { bindCategoryIds, remapPlanCategories }
