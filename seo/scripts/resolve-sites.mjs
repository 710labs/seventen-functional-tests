#!/usr/bin/env node
// Emits the GitHub Actions matrix for enabled sites (one line: matrix=<json>).
//   node seo/scripts/resolve-sites.mjs [siteId] >> "$GITHUB_OUTPUT"
import { loadConfig, enabledSites } from '../lib/config.mjs'

const only = (process.argv[2] ?? '').trim()
const cfg = loadConfig()
const matrix = enabledSites(cfg, only).map(s => {
	const state = process.env.ROBOTS_EXPECTED_STATE || s.robotsExpectedState
	const pages = s.lighthousePages ?? s.keyPages
	return {
		id: s.id,
		name: s.name ?? s.id,
		baseUrl: s.baseUrl,
		robotsState: state,
		lighthouseConfig: `seo/lighthouse/lighthouserc.${state}.json`,
		lighthouseUrlArgs: pages.map(p => `--collect.url=${s.baseUrl}${p}`).join(' '),
		hasGsc: Boolean(s.gsc?.property),
	}
})
if (matrix.length === 0) throw new Error('No enabled sites — nothing to check.')
console.log(`matrix=${JSON.stringify(matrix)}`)
