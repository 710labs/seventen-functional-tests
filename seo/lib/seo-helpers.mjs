// Pure helpers — no Playwright dependency, fully unit-tested in seo/tests/unit.

/**
 * True when robots.txt blocks the whole site for all crawlers, i.e. the `User-agent: *`
 * group contains `Disallow: /` and no `Allow: /` that re-opens the root.
 * Handles comments, CRLF, blank lines and multi-agent groups.
 */
export function robotsBlocksEverything(robotsTxt) {
	const groups = parseRobots(robotsTxt)
	const star = groups.filter(g => g.agents.includes('*'))
	if (star.length === 0) return false
	const disallow = star.flatMap(g => g.disallow)
	const allow = star.flatMap(g => g.allow)
	return disallow.includes('/') && !allow.includes('/')
}

export function parseRobots(robotsTxt) {
	const groups = []
	let current = null
	let lastWasAgent = false
	for (const raw of String(robotsTxt ?? '').split(/\r?\n/)) {
		const line = raw.replace(/#.*$/, '').trim()
		if (!line) continue
		const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
		if (!m) continue
		const field = m[1].toLowerCase()
		const value = m[2].trim()
		if (field === 'user-agent') {
			if (!current || !lastWasAgent) {
				current = { agents: [], allow: [], disallow: [] }
				groups.push(current)
			}
			current.agents.push(value.toLowerCase())
			lastWasAgent = true
			continue
		}
		lastWasAgent = false
		if (!current) continue
		if (field === 'disallow' && value) current.disallow.push(value)
		if (field === 'allow' && value) current.allow.push(value)
	}
	return groups
}

export function robotsSitemapUrls(robotsTxt) {
	return String(robotsTxt ?? '')
		.split(/\r?\n/)
		.map(l => l.match(/^\s*sitemap\s*:\s*(\S+)/i)?.[1])
		.filter(Boolean)
}

/** Flatten @type values from a JSON-LD node, array, or @graph container. */
export function jsonLdTypes(node) {
	if (!node || typeof node !== 'object') return []
	if (Array.isArray(node)) return node.flatMap(jsonLdTypes)
	const t = node['@type']
	const own = Array.isArray(t) ? t : t ? [t] : []
	return [...own, ...(node['@graph'] ? jsonLdTypes(node['@graph']) : [])]
}

/** Find the first JSON-LD node of a given @type (searches arrays and @graph). */
export function findJsonLdNode(nodes, type) {
	const stack = Array.isArray(nodes) ? [...nodes] : [nodes]
	while (stack.length) {
		const n = stack.shift()
		if (!n || typeof n !== 'object') continue
		if (Array.isArray(n)) {
			stack.push(...n)
			continue
		}
		const t = n['@type']
		if ((Array.isArray(t) ? t : [t]).includes(type)) return n
		if (n['@graph']) stack.push(n['@graph'])
	}
	return undefined
}

/**
 * Deterministic daily rotation over a list: a different contiguous window each day,
 * so the whole catalog gets covered over ceil(n / size) days without hammering the site.
 */
export function pickRotatingSample(items, size, seed) {
	if (!Array.isArray(items) || size <= 0) return []
	if (items.length <= size) return [...items]
	const start = (((seed * size) % items.length) + items.length) % items.length
	return Array.from({ length: size }, (_, i) => items[(start + i) % items.length])
}

export const dayIndex = (now = Date.now()) => Math.floor(now / 86_400_000)

/** Normalize URLs for de-duplication: drop hash + query, keep trailing slash as-is. */
export function normalizeUrl(href) {
	try {
		const u = new URL(href)
		u.hash = ''
		u.search = ''
		return u.toString()
	} catch {
		return null
	}
}

export function uniqueSameOriginUrls(hrefs, baseUrl) {
	const origin = new URL(baseUrl).origin
	const out = new Set()
	for (const h of hrefs) {
		const n = normalizeUrl(h)
		if (n && new URL(n).origin === origin) out.add(n)
	}
	return [...out]
}
