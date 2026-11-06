const { assertBulkBaseUrl } = require('./environment.cjs')
const rules = require('./rules.json')
const dev = require('./dev-pickup-taxes.json')
const stage = require('./stage-pickup-taxes.json')
const stageMetadata = require('./stage-rule-metadata.json')

const profiles = new Map([dev, stage].map(profile => [profile.source.environment, profile]))

function rulesForEnvironment(baseUrl) {
	const origin = assertBulkBaseUrl(baseUrl)
	const profile = profiles.get(origin)
	if (!profile) throw new Error(`Bulk tax profile missing for ${origin}`)
	// Each test gets independent expectations; never fall back to another environment.
	const result = structuredClone({ ...rules, taxes: profile.taxes, taxRounding: profile.taxRounding })
	if (origin === stageMetadata.source.environment) {
		for (const rule of result.bulkRules) {
			const couponKey = stageMetadata.couponKeysByCategorySlug[rule.categorySlug]
			if (couponKey) rule.couponKey = couponKey
			if (stageMetadata.disabledCategorySlugs.includes(rule.categorySlug)) rule.enabled = false
		}
	}
	return result
}

module.exports = { rulesForEnvironment }
