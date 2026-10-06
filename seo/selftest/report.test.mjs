// Unit tests for the daily digest + GSC math. Run: node --test seo/selftest/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, summarizeLighthouse, collect } from '../scripts/report.mjs'
import { evaluate, pctChange, windows } from '../scripts/gsc-report.mjs'

const baseSite = {
	id: 'live',
	name: '710 Labs Live',
	baseUrl: 'https://live.710labs.com',
	robotsState: 'blocked',
}
const cleanTech = {
	total: 6,
	passed: 6,
	flaky: 0,
	failed: 0,
	failures: [],
	otherErrors: [],
	warnings: [],
	fixedKnownIssues: [],
	info: [],
}
const lhClean = {
	pages: [{ path: '/shop/', seo: 0.61, performance: 0.55, accessibility: 0.9 }],
	errors: [],
	warnings: [],
}

test('all clean → green, pre-launch mode line shown', () => {
	const r = buildReport({
		sites: [{ ...baseSite, technical: cleanTech, lighthouse: lhClean, gsc: null }],
	})
	assert.equal(r.status, 'green')
	assert.match(r.slackText, /pre-launch/)
	assert.match(r.slackText, /SEO score capped/)
})

test('known issues only → amber, listed as warnings, not failures', () => {
	const tech = {
		...cleanTech,
		warnings: ['single-h1:/shop/: expected 1 <h1>, found 5', 'sitemap-present: HTTP 404'],
	}
	const r = buildReport({ sites: [{ ...baseSite, technical: tech, lighthouse: lhClean }] })
	assert.equal(r.status, 'amber')
	assert.match(r.slackText, /Known issues \/ warnings:\* single-h1:\/shop\/, sitemap-present/)
	assert.doesNotMatch(r.slackText, /Failing/)
})

test('fixed known issue → amber with removal prompt', () => {
	const tech = { ...cleanTech, fixedKnownIssues: ['org-schema:/shop/: now passing — remove it'] }
	const r = buildReport({ sites: [{ ...baseSite, technical: tech }] })
	assert.equal(r.status, 'amber')
	assert.match(r.slackText, /remove from knownIssues:\* org-schema:\/shop\//)
})

test('new technical failure → red', () => {
	const tech = {
		...cleanTech,
		failed: 1,
		passed: 5,
		failures: ['product-schema:/product/x/: missing Product JSON-LD'],
	}
	const r = buildReport({ sites: [{ ...baseSite, technical: tech }] })
	assert.equal(r.status, 'red')
	assert.match(r.slackText, /Failing:\* product-schema:\/product\/x\//)
})

test('robots-state failure → red with a loud robots line', () => {
	const tech = {
		...cleanTech,
		failed: 1,
		failures: ['robots-state: robots.txt no longer fully blocks crawlers'],
	}
	const r = buildReport({ sites: [{ ...baseSite, technical: tech }] })
	assert.equal(r.status, 'red')
	assert.match(r.slackText, /robots\.txt changed/)
	const open = buildReport({
		sites: [
			{
				...baseSite,
				robotsState: 'open',
				technical: { ...tech, failures: ['robots-state: blocks ALL'] },
			},
		],
	})
	assert.match(open.slackText, /blocking ALL crawlers/)
})

test('crashed job (no results but job failed) → red; skipped job → not red', () => {
	const crashed = buildReport({
		sites: [{ ...baseSite, technical: null, lighthouse: lhClean }],
		jobs: { technical: 'failure', lighthouse: 'success' },
	})
	assert.equal(crashed.status, 'red')
	assert.match(crashed.slackText, /no results — job failure/)
	const skipped = buildReport({
		sites: [{ ...baseSite, technical: null, lighthouse: lhClean }],
		jobs: { technical: 'skipped' },
	})
	assert.equal(skipped.status, 'green')
})

test('lighthouse error assertion → red; warning → amber', () => {
	const err = buildReport({
		sites: [
			{
				...baseSite,
				technical: cleanTech,
				lighthouse: { ...lhClean, errors: ['document-title on /shop/'] },
			},
		],
	})
	assert.equal(err.status, 'red')
	const warn = buildReport({
		sites: [
			{
				...baseSite,
				technical: cleanTech,
				lighthouse: { ...lhClean, warnings: ['image-alt on /shop/'] },
			},
		],
	})
	assert.equal(warn.status, 'amber')
})

test('GSC cliff and API error → red; skipped → note only', () => {
	const w = { current: { startDate: 'a', endDate: 'b' } }
	const cliff = buildReport({
		sites: [
			{
				...baseSite,
				technical: cleanTech,
				gsc: {
					status: 'cliff',
					windows: w,
					totals: { clicks: 10, impressions: 100, position: 5 },
					clicksDeltaPct: -60,
					impressionsDeltaPct: -20,
				},
			},
		],
	})
	assert.equal(cliff.status, 'red')
	assert.match(cliff.slackText, /Clicks dropped -60%/)
	const apiErr = buildReport({
		sites: [
			{ ...baseSite, technical: cleanTech, gsc: { status: 'error', error: 'invalid_grant' } },
		],
	})
	assert.equal(apiErr.status, 'red')
	const skipped = buildReport({
		sites: [
			{ ...baseSite, technical: cleanTech, gsc: { status: 'skipped', reason: 'secret not set' } },
		],
	})
	assert.equal(skipped.status, 'green')
	assert.match(skipped.slackText, /skipped \(secret not set\)/)
})

test('slack text is capped for Slack limits', () => {
	const tech = {
		...cleanTech,
		failures: Array.from({ length: 400 }, (_, i) => `id-${i}: ${'x'.repeat(150)}`),
	}
	const r = buildReport({ sites: [{ ...baseSite, technical: tech }] })
	assert.ok(r.slackText.length <= 3800)
})

test('summarizeLighthouse keeps representative runs and splits error/warn', () => {
	const s = summarizeLighthouse(
		[
			{ url: 'https://x.com/shop/', isRepresentativeRun: true, summary: { seo: 0.9 } },
			{ url: 'https://x.com/shop/', isRepresentativeRun: false, summary: { seo: 0.1 } },
		],
		[
			{
				auditId: 'document-title',
				url: 'https://x.com/shop/',
				level: 'error',
				passed: false,
				actual: 0,
				expected: 0.9,
				operator: '>=',
			},
			{
				auditId: 'image-alt',
				url: 'https://x.com/shop/',
				level: 'warn',
				passed: false,
				actual: 0,
				expected: 0.9,
				operator: '>=',
			},
			{ auditId: 'canonical', url: 'https://x.com/shop/', level: 'warn', passed: true },
		],
	)
	assert.equal(s.pages.length, 1)
	assert.equal(s.errors.length, 1)
	assert.equal(s.warnings.length, 1)
	assert.equal(summarizeLighthouse(null, null), null)
})

test('collect + buildReport on real sample artifacts (prod-mirror run, real LHCI output)', () => {
	const cfg = {
		sites: [
			{
				id: 'live',
				name: '710 Labs Live',
				baseUrl: 'https://live.710labs.com',
				robotsExpectedState: 'blocked',
				enabled: true,
			},
		],
	}
	const sites = collect('seo/selftest/samples/out', cfg, '')
	assert.equal(sites.length, 1)
	assert.ok(sites[0].technical.total > 0, 'technical results parsed')
	assert.ok(sites[0].lighthouse.pages.length > 0, 'lighthouse manifest parsed')
	assert.equal(sites[0].gsc.status, 'ok')
	const r = buildReport({ sites, runUrl: 'https://github.com/x/y/actions/runs/1' })
	assert.equal(r.status, 'amber') // known issues + lighthouse warnings, no hard failures
	assert.match(r.slackText, /view run/)
})

test('GSC math', () => {
	assert.equal(pctChange(50, 100), -50)
	assert.equal(pctChange(0, 0), 0)
	assert.equal(pctChange(5, 0), null)
	assert.equal(
		evaluate({
			totals: { clicks: 50, impressions: 1 },
			previousTotals: { clicks: 100, impressions: 1 },
		}).cliff,
		true,
	)
	assert.equal(
		evaluate({
			totals: { clicks: 1, impressions: 1 },
			previousTotals: { clicks: 10, impressions: 1 },
		}).cliff,
		false,
		'below baseline never cliffs',
	)
	assert.equal(
		evaluate({
			totals: { clicks: 70, impressions: 1 },
			previousTotals: { clicks: 100, impressions: 1 },
		}).cliff,
		false,
	)
	const w = windows(new Date('2026-10-05T12:00:00Z'))
	assert.deepEqual(w.current, { startDate: '2026-09-26', endDate: '2026-10-02' })
	assert.deepEqual(w.previous, { startDate: '2026-09-19', endDate: '2026-09-25' })
})

test('Actions job ids map to digest lanes and missing rankings are red', async () => {
	const { jobResults } = await import('../scripts/report.mjs')
	const jobs = jobResults(
		JSON.stringify({
			'seo-technical': { result: 'failure' },
			'seo-lighthouse': { result: 'success' },
			'seo-rankings': { result: 'failure' },
		}),
	)
	assert.deepEqual(jobs, { technical: 'failure', lighthouse: 'success', rankings: 'failure' })
	for (const lane of ['technical', 'lighthouse', 'rankings']) {
		const r = buildReport({ sites: [{ ...baseSite }], jobs: { [lane]: 'failure' } })
		assert.equal(r.status, 'red', lane)
		assert.match(r.slackText, /no results/)
	}
})

test('missing robots evidence does not claim crawl state is verified', () => {
	const r = buildReport({ sites: [{ ...baseSite }], jobs: { technical: 'failure' } })
	assert.match(r.slackText, /robots.txt state unverified/)
	assert.doesNotMatch(r.slackText, /as expected|crawlable ✅/)
})

test('global Playwright errors remain hard failures in the digest', async () => {
	const { summarizeTechnical } = await import('../lib/results.mjs')
	const t = summarizeTechnical({ suites: [], errors: [{ message: 'spec could not load' }] })
	assert.ok(t.otherErrors.includes('spec could not load'))
	assert.equal(buildReport({ sites: [{ ...baseSite, technical: t }] }).status, 'red')
})

test('flaky tests count as passed and final runtime annotations are deduped', async () => {
	const { summarizeTechnical } = await import('../lib/results.mjs')
	const warning = { type: 'seo-warning', description: 'sitemap-present: missing' }
	const t = summarizeTechnical({
		suites: [
			{
				specs: [
					{
						title: 'sitemap',
						tests: [
							{
								status: 'flaky',
								annotations: [warning],
								results: [{ errors: [{ message: 'transient' }] }, { annotations: [warning] }],
							},
						],
					},
				],
			},
		],
	})
	assert.equal(t.passed, 1)
	assert.equal(t.flaky, 1)
	assert.equal(t.warnings.length, 1)
	assert.deepEqual(t.otherErrors, [])
})

test('Lighthouse upload without assertion results is incomplete', () => {
	assert.equal(
		summarizeLighthouse([{ url: 'https://x.com/', isRepresentativeRun: true, summary: {} }], null),
		null,
	)
})

test('GSC missing secret skips; malformed credential is an error', async () => {
	const { spawnSync } = await import('node:child_process')
	const { mkdtempSync, readFileSync, rmSync } = await import('node:fs')
	const { tmpdir } = await import('node:os')
	const out = mkdtempSync(`${tmpdir()}/seo-gsc-`)
	try {
		for (const [key, code, status] of [
			['', 0, 'skipped'],
			['invalid-json', 2, 'error'],
		]) {
			const run = spawnSync(process.execPath, ['seo/scripts/gsc-report.mjs'], {
				env: { ...process.env, SEO_SITE: 'live', SEO_OUT_DIR: out, GSC_SERVICE_ACCOUNT_KEY: key },
				encoding: 'utf8',
			})
			assert.equal(run.status, code)
			assert.equal(JSON.parse(readFileSync(`${out}/gsc.json`, 'utf8')).status, status)
		}
	} finally {
		rmSync(out, { recursive: true, force: true })
	}
})

test('digest runs without installed dependencies and explicit Slack posting requires a webhook', async () => {
	const { spawnSync } = await import('node:child_process')
	const { mkdtempSync, cpSync, rmSync } = await import('node:fs')
	const { tmpdir } = await import('node:os')
	const dir = mkdtempSync(`${tmpdir()}/seo-report-`)
	try {
		for (const part of ['lib', 'scripts', 'config'])
			cpSync(`seo/${part}`, `${dir}/seo/${part}`, { recursive: true })
		const run = (args, post) =>
			spawnSync(process.execPath, ['seo/scripts/report.mjs', ...args], {
				cwd: dir,
				env: {
					...process.env,
					SEO_OUT_ROOT: 'seo/out',
					SEO_CONFIG: 'seo/config/sites.json',
					SEO_ONLY_SITE: '',
					NEEDS_JSON: '{}',
					SLACK_WEBHOOK_URL: '',
					POST_TO_SLACK: post,
				},
				encoding: 'utf8',
			})
		assert.equal(run(['--dry-run'], 'true').status, 0)
		assert.equal(run([], 'false').status, 0)
		assert.equal(run([], 'true').status, 1)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('empty technical report cannot produce a green digest', async () => {
	const { summarizeTechnical } = await import('../lib/results.mjs')
	assert.equal(
		buildReport({ sites: [{ ...baseSite, technical: summarizeTechnical({ suites: [] }) }] }).status,
		'red',
	)
})
