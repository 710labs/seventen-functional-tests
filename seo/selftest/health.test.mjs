import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, cpSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { toHealthResult } from '../lib/health-results.mjs'
import seoChecks from '../../scripts/health/seo-checks.js'

const clean = {
	id: 'live',
	name: 'LIVE - PROD',
	healthCheckId: 'seo-live-prod',
	baseUrl: 'https://live.710labs.com',
	robotsState: 'blocked',
	technical: {
		total: 6,
		passed: 6,
		failed: 0,
		flaky: 0,
		failures: [],
		otherErrors: [],
		warnings: [],
		fixedKnownIssues: [],
	},
	lighthouse: { pages: [{ path: '/shop/', seo: 0.69 }], errors: [], warnings: [] },
	gsc: { status: 'skipped', reason: 'no secret' },
}

test('SEO clean findings become a passed health result; GSC skip stays explicit', () => {
	const result = toHealthResult(
		clean,
		'https://github.com/710labs/seventen-functional-tests/actions/runs/1',
	)
	assert.equal(result.status, 'passed')
	assert.equal(result.id, 'seo-live-prod')
	assert.equal(result.group, 'SEO')
	assert.deepEqual(result.seo, { technical: 'passed', lighthouse: 'passed', rankings: 'skipped' })
	assert.match(result.seoMarkdown, /LIVE - PROD/)
})

test('known warnings, fixed issues, and Lighthouse warnings remain amber health results', () => {
	for (const site of [
		{ ...clean, technical: { ...clean.technical, warnings: ['single-h1:/shop/: 5 H1s'] } },
		{
			...clean,
			technical: { ...clean.technical, fixedKnownIssues: ['img-alt:/shop/: now fixed'] },
		},
		{ ...clean, lighthouse: { ...clean.lighthouse, warnings: ['image-alt on /shop/'] } },
	]) {
		const result = toHealthResult(site)
		assert.equal(result.status, 'warning')
		assert.deepEqual(result.failureSummary, [])
		assert.equal(result.warningSummary.length, 1)
	}
})

test('hard SEO outages cannot be hidden by warnings in Daily System Health', () => {
	const result = toHealthResult({
		...clean,
		technical: { ...clean.technical, otherErrors: ['shop: HTTP 404'], warnings: ['known: gap'] },
	})
	assert.equal(result.status, 'failed')
	assert.equal(result.seo.technical, 'failed')
	assert.match(result.failureSummary[0], /HTTP 404/)
})

test('missing technical, Lighthouse, or GSC outputs always fail the environment', () => {
	for (const field of ['technical', 'lighthouse', 'gsc'])
		assert.equal(toHealthResult({ ...clean, [field]: null }).status, 'failed', field)
})

test('GSC errors, cliffs, and invalid statuses fail the health result', () => {
	for (const gsc of [
		{ status: 'error', error: 'invalid_grant' },
		{
			status: 'cliff',
			clicksDeltaPct: -50,
			impressionsDeltaPct: 0,
			totals: { clicks: 20, impressions: 100, position: 4 },
			windows: { current: { startDate: 'a', endDate: 'b' } },
		},
		{ status: 'invalid' },
	]) {
		const result = toHealthResult({ ...clean, gsc })
		assert.equal(result.status, 'failed')
		assert.equal(result.seo.rankings, 'failed')
	}
})

test('SEO health manifest is config-derived, including new enabled sites and excluding disabled sites', () => {
	const sites = [
		{ id: 'new', name: 'NEW SITE', enabled: true },
		{ id: 'off', enabled: false },
	]
	assert.deepEqual(seoChecks.getSeoChecks(sites), [
		{ id: 'seo-new', label: 'NEW SITE', group: 'SEO', type: 'seo', seoSiteId: 'new' },
	])
	const cfg = JSON.parse(readFileSync('seo/config/sites.json', 'utf8'))
	assert.deepEqual(
		seoChecks.getSeoChecks(cfg.sites).slice(0, 3).map(check => check.label),
		['LIVE - PROD', 'LIVE - STAGE', 'LIVE - DEV'],
	)
})

test('health-report writes three artifacts and an SEO section without sending Slack', () => {
	const dir = mkdtempSync(`${tmpdir()}/seo-health-`)
	try {
		cpSync('seo/selftest/samples/out', `${dir}/out`, { recursive: true })
		const run = spawnSync(process.execPath, ['seo/scripts/health-report.mjs'], {
			encoding: 'utf8',
			env: {
				...process.env,
				SEO_OUT_ROOT: `${dir}/out`,
				SEO_CONFIG: 'seo/config/sites.json',
				SEO_ONLY_SITE: '',
				HEALTH_RESULTS_DIR: `${dir}/health`,
				GITHUB_STEP_SUMMARY: `${dir}/summary.md`,
				RUN_URL: '',
				POST_TO_SLACK: 'true',
				SLACK_WEBHOOK_URL: 'http://127.0.0.1:1',
			},
		})
		assert.equal(run.status, 0, run.stderr)
		for (const env of ['prod', 'stage', 'dev']) {
			const result = JSON.parse(readFileSync(`${dir}/health/seo-live-${env}.json`, 'utf8'))
			assert.equal(result.label, `LIVE - ${env.toUpperCase()}`)
			assert.equal(result.status, env === 'prod' ? 'warning' : 'failed')
		}
		assert.match(readFileSync(`${dir}/summary.md`, 'utf8'), /^## SEO\n/)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
