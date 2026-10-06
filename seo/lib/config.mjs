// Shared config loader for the SEO pulse (used by Playwright tests and node scripts).
// Plain ESM JS so scripts run with `node` and tests can import it from TS.
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const DEFAULT_CONFIG_PATH = 'seo/config/sites.json'

export function loadConfig(configPath = process.env.SEO_CONFIG ?? DEFAULT_CONFIG_PATH) {
	const abs = path.resolve(process.cwd(), configPath)
	const cfg = JSON.parse(readFileSync(abs, 'utf8'))
	validateConfig(cfg, abs)
	return cfg
}

export function validateConfig(cfg, label = 'config') {
	const errors = []
	if (!cfg || !Array.isArray(cfg.sites) || cfg.sites.length === 0)
		errors.push('sites[] must be a non-empty array')
	const ids = new Set()
	for (const [i, s] of (cfg?.sites ?? []).entries()) {
		const where = `sites[${i}]${s?.id ? ` (${s.id})` : ''}`
		for (const key of [
			'id',
			'baseUrl',
			'canonicalHost',
			'robotsExpectedState',
			'keyPages',
			'productListPath',
			'productLinkSelector',
		]) {
			if (s?.[key] === undefined) errors.push(`${where}: missing "${key}"`)
		}
		if (s?.id && ids.has(s.id)) errors.push(`${where}: duplicate id`)
		ids.add(s?.id)
		if (s?.robotsExpectedState && !['blocked', 'open'].includes(s.robotsExpectedState)) {
			errors.push(`${where}: robotsExpectedState must be "blocked" or "open"`)
		}
		if (s?.baseUrl && /\/$/.test(s.baseUrl)) errors.push(`${where}: baseUrl must not end with "/"`)
		if (s?.keyPages && !s.keyPages.every(p => p.startsWith('/')))
			errors.push(`${where}: keyPages must start with "/"`)
	}
	if (errors.length) throw new Error(`Invalid SEO config (${label}):\n - ${errors.join('\n - ')}`)
}

/**
 * Resolve the site under test. Env overrides exist for emergencies and self-tests:
 *  SEO_SITE                 site id (default: first enabled site)
 *  SEO_BASE_URL             point the checks at another origin (e.g. a local fixture)
 *  ROBOTS_EXPECTED_STATE    temporarily override the config value ("blocked" | "open")
 */
export function resolveSite(cfg = loadConfig(), env = process.env) {
	const id = env.SEO_SITE
	const site = id ? cfg.sites.find(s => s.id === id) : cfg.sites.find(s => s.enabled)
	if (!site) throw new Error(id ? `Unknown SEO_SITE "${id}"` : 'No enabled site in SEO config')
	const thresholds = { ...(cfg.defaults?.thresholds ?? {}), ...(site.thresholds ?? {}) }
	const robotsExpectedState = env.ROBOTS_EXPECTED_STATE || site.robotsExpectedState
	if (!['blocked', 'open'].includes(robotsExpectedState)) {
		throw new Error(
			`ROBOTS_EXPECTED_STATE must be "blocked" or "open" (got "${robotsExpectedState}")`,
		)
	}
	return {
		...site,
		baseUrl: (env.SEO_BASE_URL || site.baseUrl).replace(/\/$/, ''),
		robotsExpectedState,
		knownIssues: site.knownIssues ?? [],
		organizationSchemaPages: site.organizationSchemaPages ?? [],
		productSampleSize: site.productSampleSize ?? 5,
		thresholds,
	}
}

export function enabledSites(cfg = loadConfig(), only = '') {
	const list = cfg.sites.filter(s => s.enabled && (!only || s.id === only))
	if (only && list.length === 0)
		throw new Error(`Site "${only}" is not an enabled site in the SEO config`)
	return list
}
