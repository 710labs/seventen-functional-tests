const path = require('node:path')
const { execFileSync } = require('node:child_process')

const root = path.resolve(__dirname, '../..')
const categories = new Set([
	'google-maps-referrer-denied', 'google-maps-configuration', 'address-widget-unavailable',
	'address-autocomplete', 'address-selection', 'timeout', 'assertion',
	'browser-closed', 'browser-launch', 'network', 'recording-policy', 'test-error',
])
const phases = new Set(['address-entry', 'admin-login', 'admin-user-creation', 'registration',
	'login', 'cart', 'checkout', 'account', 'setup', 'teardown', 'test'])
let trackedSources

function sources() {
	if (!trackedSources) {
		try {
			// Only repository-owned source names can be published. Never echo an
			// arbitrary stack path, dynamic test title, URL or generated filename.
			trackedSources = new Set(execFileSync('git', ['ls-files', '-z', '--', 'models', 'tests', 'support', 'utils', 'options.ts'], {
				cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
			}).split('\0').filter(file => /\.[cm]?[jt]sx?$/.test(file)))
		} catch { trackedSources = new Set() }
	}
	return trackedSources
}

function categoryFor(error, status) {
	const message = String(error?.message || '').replace(/\u001b\[[0-9;]*m/g, '')
	if (/ADDRESS_REFERRER_DENIED|RefererNotAllowedMapError/.test(message)) return 'google-maps-referrer-denied'
	if (/ADDRESS_API_CONFIGURATION|ApiNotActivatedMapError|InvalidKeyMapError|BillingNotEnabledMapError/.test(message)) return 'google-maps-configuration'
	if (message.includes('ADDRESS_WIDGET_UNAVAILABLE')) return 'address-widget-unavailable'
	if (message.includes('ADDRESS_SELECTION_FAILED')) return 'address-selection'
	if (message.includes('ADDRESS_AUTOCOMPLETE_FAILED')) return 'address-autocomplete'
	if (message.includes('Browser recording is prohibited')) return 'recording-policy'
	if (/browserType.launch|Executable doesn't exist/.test(message)) return 'browser-launch'
	if (/Target .*closed|browser has been closed/.test(message)) return 'browser-closed'
	if (/net::ERR_|ECONNREFUSED|ENOTFOUND/.test(message)) return 'network'
	if (status === 'timedOut' || /Timeout|timed out/i.test(message)) return 'timeout'
	if (/expect\(|AssertionError/.test(message)) return 'assertion'
	return 'test-error'
}

function phaseFor(steps) {
	for (const step of [...steps].reverse()) {
		if (step.category === 'hook') return /after/i.test(step.title) ? 'teardown' : 'setup'
		if (step.category !== 'test.step') continue
		const title = step.title || ''
		if (/address|autocomplete/i.test(title)) return 'address-entry'
		if (/WP Admin|WP Dash|Login.*Admin/i.test(title)) return 'admin-login'
		if (/Users page|New User details|Submit New User|New User was Created/i.test(title)) return 'admin-user-creation'
		if (/register|registration|New Customer|Birthdate|Med Card|Drivers License/i.test(title)) return 'registration'
		if (/checkout|place order|complete order/i.test(title)) return 'checkout'
		if (/cart|product/i.test(title)) return 'cart'
		if (/login|sign in|sign out|log out/i.test(title)) return 'login'
		if (/account/i.test(title)) return 'account'
	}
	return 'test'
}

function sanitizeFailure(value) {
	const result = {
		category: categories.has(value?.category) ? value.category : 'test-error',
		phase: phases.has(value?.phase) ? value.phase : 'test',
	}
	if (sources().has(value?.file) && Number.isSafeInteger(value.line) && value.line > 0) {
		result.file = value.file
		result.line = value.line
	}
	return result
}

function failureFor(result) {
	// Preserve a useful user step and the deepest failed operation underneath it.
	function failedBranch(steps) {
		for (const step of steps || []) {
			const child = failedBranch(step.steps)
			if (child.length || step.error) return [step, ...child]
		}
		return []
	}
	const branch = failedBranch(result?.steps)
	const error = result?.error || result?.errors?.[0] || branch.at(-1)?.error
	const location = [...branch].reverse().map(step => step.location).find(loc => loc && sources().has(path.relative(root, loc.file).split(path.sep).join('/')))
	return sanitizeFailure({
		category: categoryFor(error, result?.status), phase: phaseFor(branch),
		file: location && path.relative(root, location.file).split(path.sep).join('/'), line: location?.line,
	})
}

function testFailure(test) {
	const result = [...(test.results || [])].reverse().find(result =>
		['failed', 'timedOut', 'interrupted'].includes(result.status))
	return failureFor(result)
}

function failureLabel(test) {
	const failure = testFailure(test)
	return `${failure.category}; ${failure.phase}${failure.file ? `; ${failure.file}:${failure.line}` : ''}`
}

module.exports = { categoryFor, failureFor, testFailure, failureLabel, sanitizeFailure }
