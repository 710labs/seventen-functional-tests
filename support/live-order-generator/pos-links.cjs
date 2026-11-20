const providerDomains = { dutchie: 'dutchie.com', blaze: 'blaze.me', treez: 'treez.io', meadow: 'getmeadow.com' }

function externalOrderId(value) {
	if (typeof value !== 'string' && typeof value !== 'number') return null
	const id = String(value).trim()
	return id && id.length <= 200 && !/[\x00-\x1f\x7f]/.test(id) ? id : null
}

function safePosOrderUrl(raw, pos) {
	try {
		if (typeof raw !== 'string' || raw.length > 1000) return null
		const url = new URL(raw)
		const domain = providerDomains[pos]
		if (!domain || url.protocol !== 'https:' || url.username || url.password || url.port) return null
		if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) return null
		// Publish navigational links, never authenticated API or signed URLs.
		if ([...url.searchParams.keys()].some(key => /auth|token|secret|password|signature|api.?key|nonce/i.test(key))) return null
		if (/[?&#](?:[^=&#]*(?:auth|token|secret|password|signature|api.?key|nonce)[^=&#]*)=/i.test(decodeURIComponent(url.hash))) return null
		return url.href.replace(/[<>|]/g, character => encodeURIComponent(character))
	} catch { return null }
}

function configuredPosOrderUrl(id, pos, env = process.env) {
	const template = env[`LIVE_STAGE_${pos.toUpperCase()}_ORDER_URL_TEMPLATE`]
	if (!id || typeof template !== 'string' || !template.includes('{externalId}')) return null
	return safePosOrderUrl(template.split('{externalId}').join(encodeURIComponent(id)), pos)
}

function posOrderDetails(body, target, env = process.env) {
	const type = String(body?.instanceType || '').trim().toLowerCase()
	if (String(body?.instanceId ?? body?.instanceID ?? '') !== target.instanceId ||
		!new RegExp(`^${target.pos}(?:$|[^a-z])`).test(type)) {
		return { externalId: null, posOrderUrl: null }
	}
	const id = externalOrderId(body.externalId ?? body.externalID)
	const suppliedUrl = [body.posOrderUrl, body.posOrderURL, body.externalUrl, body.externalURL]
		.map(url => safePosOrderUrl(url, target.pos)).find(Boolean)
	return { externalId: id, posOrderUrl: id ? suppliedUrl || configuredPosOrderUrl(id, target.pos, env) : null }
}

module.exports = { externalOrderId, safePosOrderUrl, configuredPosOrderUrl, posOrderDetails }
