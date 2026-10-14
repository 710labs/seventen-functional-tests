// The one place that decides whether a failed SEO check FAILS the run or only WARNS.
//
// Every check has a stable id (e.g. "single-h1:/shop/"). Ids listed in the site's
// `knownIssues` are reported daily as warnings instead of failing the run — so the
// channel isn't red every day for issues we've already accepted — and when a known
// issue starts passing, it's flagged so someone removes it from the list (ratchet).
import { expect } from '@playwright/test'

import { ANNOTATION } from './annotations.mjs'
export { ANNOTATION } from './annotations.mjs'

export function makeChecker(site) {
	const known = new Set(site.knownIssues ?? [])
	return function check(testInfo, id, passed, detail, { warnOnly = false } = {}) {
		if (passed) {
			if (known.has(id)) {
				testInfo.annotations.push({
					type: ANNOTATION.fixed,
					description: `${id}: now passing — remove it from knownIssues in seo/config/sites.json`,
				})
			}
			return true
		}
		if (known.has(id) || warnOnly) {
			testInfo.annotations.push({ type: ANNOTATION.warning, description: `${id}: ${detail}` })
			return false
		}
		testInfo.annotations.push({ type: ANNOTATION.failure, description: `${id}: ${detail}` })
		// Soft so one test can report several independent failures in one run.
		expect.soft(passed, `${id}: ${detail}`).toBe(true)
		return false
	}
}

export function info(testInfo, description) {
	testInfo.annotations.push({ type: ANNOTATION.info, description })
}
