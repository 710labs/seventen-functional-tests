const STAGE_URL = 'https://live-stage.710labs.com'
const ORDERS_PER_POS = 2
const targets = [
	{ pos: 'dutchie', store: '710 Labs - MI Sandbox', slug: 'test-facility', instanceId: '10', facilityId: '13' },
	{ pos: 'blaze', store: 'Spaceflyt - Culver City', slug: 'spaceflyt-culver-city', instanceId: '4', facilityId: '3' },
	{ pos: 'treez', store: 'Sticky Thumb - South SF', slug: 'sticky-thumb-south-sf', instanceId: '15', facilityId: '10' },
	{ pos: 'meadow', store: 'The Artist Tree - Beverly Hills', slug: 'the-artist-tree-beverly-hills', instanceId: '19', facilityId: '6' },
]

function selectTargets(selection = 'all') {
	const selected = selection === 'all' ? targets : targets.filter(target => target.pos === selection)
	if (!selected.length) throw new Error('Unknown Live Stage POS selection')
	return selected
}

function assertStageUrl(raw) {
	const url = new URL(raw)
	if (url.origin !== STAGE_URL || url.username || url.password) {
		throw new Error('Order generator is restricted to https://live-stage.710labs.com')
	}
	return url
}

// Use instance identity as well as type: an external ID on a different sandbox
// does not prove that the intended store received the order.
function transmissionProblem(body, target) {
	if (!body || body.outcome !== 'success') return 'POS transmission is not successful yet'
	if (String(body.instanceId ?? body.instanceID ?? '') !== target.instanceId) return 'POS instance mismatch'
	const type = String(body.instanceType || '').trim().toLowerCase()
	if (!new RegExp(`^${target.pos}(?:$|[^a-z])`).test(type)) return 'POS type mismatch'
	if (!String(body.instanceName || '').trim()) return 'Missing POS instance name'
	if (!String(body.externalId ?? body.externalID ?? '').trim()) return 'Missing POS external order ID'
	return null
}

module.exports = { STAGE_URL, ORDERS_PER_POS, targets, selectTargets, assertStageUrl, transmissionProblem }
