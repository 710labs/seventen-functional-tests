const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { categoryFor, failureFor, testFailure, sanitizeFailure } = require('./failure-diagnostics')
const { sanitizeSummary } = require('./summary')

test('error classification emits only fixed codes', () => {
	for (const [message, category] of [
		['ADDRESS_REFERRER_DENIED secret', 'google-maps-referrer-denied'],
		['ADDRESS_WIDGET_UNAVAILABLE secret', 'address-widget-unavailable'],
		['ADDRESS_API_CONFIGURATION secret', 'google-maps-configuration'],
		['ADDRESS_AUTOCOMPLETE_FAILED secret', 'address-autocomplete'],
		['Timeout 30000ms exceeded secret', 'timeout'],
		['expect(locator).toBeVisible secret', 'assertion'],
		['browserType.launch: secret', 'browser-launch'],
		['secret', 'test-error'],
	]) assert.equal(categoryFor({ message }), category)
})

test('nested failing steps retain phase and tracked source without dynamic text', () => {
	const result = failureFor({
		status: 'failed', error: { message: 'ADDRESS_REFERRER_DENIED secret' },
		steps: [{ category: 'test.step', title: 'Enter address secret', steps: [{
			category: 'pw:api', title: 'fill("secret")', error: { message: 'secret' },
			location: { file: path.resolve('models/always-on/homepage-actions.ts'), line: 339 },
		}] }],
	})
	assert.deepEqual(result, { category: 'google-maps-referrer-denied', phase: 'address-entry', file: 'models/always-on/homepage-actions.ts', line: 339 })
	assert.ok(!JSON.stringify(result).includes('secret'))
})

test('unknown fields, untracked filenames and traversal never cross the summary boundary', () => {
	for (const file of ['../../secret.ts', '/tmp/secret.ts', 'tests/secret.spec.ts', 'models/always-on/homepage-actions.ts/../secret']) {
		assert.deepEqual(sanitizeFailure({ category: 'secret', phase: 'secret', file, line: 5, message: 'secret' }), {
			category: 'test-error', phase: 'test',
		})
	}
	const summary = sanitizeSummary({ schemaVersion: 1, status: 'failed', counts: { passed: 0, failed: 1, flaky: 0, skipped: 0 }, tests: [{
		id: '0123456789abcdef', status: 'failed', durationMs: 2, retries: 0,
		failure: { category: 'timeout', phase: 'checkout', message: 'secret', file: '/tmp/secret.ts', line: 5 },
	}] })
	assert.deepEqual(summary.tests[0].failure, { category: 'timeout', phase: 'checkout' })
	assert.ok(!JSON.stringify(summary).includes('secret'))
})

test('flaky tests retain the failing attempt diagnostic', () => {
	assert.deepEqual(testFailure({ results: [{ status: 'failed', error: { message: 'ADDRESS_WIDGET_UNAVAILABLE' } }, { status: 'passed' }] }), {
		category: 'address-widget-unavailable', phase: 'test',
	})
})
