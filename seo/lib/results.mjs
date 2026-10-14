// Parse Playwright's JSON reporter output into a flat, report-friendly shape.
// Shared by the self-test runner and the daily report so both read results identically.
import { ANNOTATION } from './annotations.mjs'

export function flattenPlaywrightJson(json) {
	const tests = []
	const walk = (suite, titlePath = []) => {
		const path = suite.title ? [...titlePath, suite.title] : titlePath
		for (const spec of suite.specs ?? []) {
			for (const t of spec.tests ?? []) {
				const results = t.results ?? []
				const last = results[results.length - 1] ?? {}
				// Runtime annotations live on the result (PW ≥1.47) and/or the test; merge + dedupe.
				const seen = new Set()
				const annotations = [...(t.annotations ?? []), ...(last.annotations ?? [])].filter(a => {
					const k = `${a.type}|${a.description}`
					if (seen.has(k)) return false
					seen.add(k)
					return true
				})
				tests.push({
					title: spec.title,
					titlePath: [...path, spec.title],
					project: t.projectName,
					status: t.status, // expected | unexpected | flaky | skipped
					retries: Math.max(0, results.length - 1),
					errors: (last.errors ?? []).map(e => stripAnsi(e.message ?? String(e))).slice(0, 5),
					annotations,
				})
			}
		}
		for (const child of suite.suites ?? []) walk(child, path)
	}
	for (const s of json?.suites ?? []) walk(s)
	return tests
}

export function summarizeTechnical(json) {
	const tests = flattenPlaywrightJson(json)
	const pick = type =>
		tests.flatMap(t => t.annotations.filter(a => a.type === type).map(a => a.description))
	const failedTests = tests.filter(t => t.status === 'unexpected')
	return {
		total: tests.length,
		passed: tests.filter(t => ['expected', 'flaky'].includes(t.status)).length,
		flaky: tests.filter(t => t.status === 'flaky').length,
		failed: failedTests.length,
		failures: pick(ANNOTATION.failure),
		// Hard failures that weren't raised through check() (navigation errors, HTTP 5xx, empty grid…)
		otherErrors: [
			...(tests.length ? [] : ['No technical tests completed']),
			...(json?.errors ?? []).map(e => stripAnsi(e.message ?? String(e))),
			...failedTests
				.filter(t => !t.annotations.some(a => a.type === ANNOTATION.failure))
				.map(t => `${t.title}: ${t.errors[0] ?? 'failed'}`),
		],
		warnings: pick(ANNOTATION.warning),
		fixedKnownIssues: pick(ANNOTATION.fixed),
		info: pick(ANNOTATION.info),
	}
}

export const stripAnsi = s => String(s).replace(/\u001b\[[0-9;]*m/g, '')

/** Stable check id = text before the first ": " in an annotation description. */
export const checkIdOf = description => String(description).split(': ')[0]
