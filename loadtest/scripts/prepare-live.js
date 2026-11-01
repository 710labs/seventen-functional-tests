const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const { buildPlan, phasesFor, SCENARIOS, FUNCTIONS } = require('../flows/live-settings')
const { buildLive } = require('./build-live')

function planFromEnv(env = process.env) {
	return buildPlan({
		target: env.ARTILLERY_TARGET,
		profile: env.LIVE_PROFILE,
		scenario: env.LIVE_SCENARIO,
		browsers: env.LIVE_BROWSERS,
		duration: env.LIVE_DURATION,
		placeOrders: env.PLACE_ORDERS,
		capacity: env.LIVE_CAPACITY,
	})
}

async function prepareLive(plan = planFromEnv()) {
	await buildLive()
	const root = path.resolve(__dirname, '..')
	const template = yaml.safeLoad(fs.readFileSync(path.join(root, 'live/browser.yml'), 'utf8'))
	const files = []
	for (const scenario of plan.matrix) {
		const config = JSON.parse(JSON.stringify(template))
		config.config.target = plan.target
		config.config.processor = './live-funnel.cjs'
		config.config.phases = phasesFor(plan)
		config.config.variables = { livePlaceOrders: String(plan.placeOrders) }
		config.scenarios = (scenario === 'mixed' ? SCENARIOS : [scenario]).map(name => ({
			name, engine: 'playwright', testFunction: FUNCTIONS[name], weight: 1,
		}))
		const file = path.join(root, `generated/live-${scenario}.yml`)
		fs.writeFileSync(file, yaml.safeDump(config, { lineWidth: -1 }))
		files.push(file)
	}
	return files
}

if (require.main === module) {
	prepareLive().then(files => console.log(files.join('\n'))).catch(error => {
		console.error(error.message)
		process.exitCode = 1
	})
}
module.exports = { prepareLive, planFromEnv }
