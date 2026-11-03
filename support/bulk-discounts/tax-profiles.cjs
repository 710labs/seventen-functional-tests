const { assertBulkBaseUrl } = require('./environment.cjs')
const rules = require('./rules.json')
const dev = require('./dev-pickup-taxes.json')
const stage = require('./stage-pickup-taxes.json')

const profiles = new Map([dev, stage].map(profile => [profile.source.environment, profile]))

function rulesForEnvironment(baseUrl) {
	const origin = assertBulkBaseUrl(baseUrl)
	const profile = profiles.get(origin)
	if (!profile) throw new Error(`Bulk tax profile missing for ${origin}`)
	// Each test gets independent expectations; never fall back to another environment.
	return structuredClone({ ...rules, taxes: profile.taxes, taxRounding: profile.taxRounding })
}

module.exports = { rulesForEnvironment }
