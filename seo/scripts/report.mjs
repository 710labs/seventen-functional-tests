#!/usr/bin/env node
/**
 * Builds ONE daily SEO digest from all job outputs and posts it to Slack + the run summary.
 *
 * Inputs (downloaded artifacts, one folder per site):
 *   seo/out/<site>/technical-results.json   Playwright JSON (seo-technical job)
 *   seo/out/<site>/lhci/reports/manifest.json, lhci/assertion-results.json   (seo-lighthouse job)
 *   seo/out/<site>/gsc.json                  (seo-rankings job)
 * Env:
 *   SEO_OUT_ROOT       default seo/out
 *   NEEDS_JSON         ${{ toJson(needs) }} — lets us tell "job crashed" from "no data"
 *   SLACK_WEBHOOK_URL  existing daily-run webhook (optional; no post when unset)
 *   POST_TO_SLACK      "false" to suppress posting (manual runs)
 *   RUN_URL            link to the Actions run
 *   GITHUB_STEP_SUMMARY  set by Actions
 * Flags: --dry-run  print the Slack text instead of posting
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadConfig } from '../lib/config.mjs'
import { summarizeTechnical, checkIdOf } from '../lib/results.mjs'

const EMOJI = { red: '🔴', amber: '🟠', green: '🟢' }
const RANK = { green: 0, amber: 1, red: 2 }
const worst = (a, b) => (RANK[a] >= RANK[b] ? a : b)
const readJson = f => {
	if (!existsSync(f)) return null
	try {
		return JSON.parse(readFileSync(f, 'utf8'))
	} catch {
		return null
	}
}
const pct = v => (v === null || v === undefined ? '–' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`)
const score = v => (typeof v === 'number' ? Math.round(v * 100) : '–')
const list = (arr, n = 6) =>
	arr.length > n ? `${arr.slice(0, n).join(', ')} … +${arr.length - n} more` : arr.join(', ')

export function summarizeLighthouse(manifest, assertions) {
	if (!manifest?.length || !Array.isArray(assertions)) return null
	const pages = manifest
		.filter(m => m.isRepresentativeRun)
		.map(m => ({ path: new URL(m.url).pathname, ...m.summary }))
	if (!pages.length) return null
	const failed = (assertions ?? []).filter(a => !a.passed)
	const describe = a =>
		`${a.auditId ?? a.name}${a.auditProperty ? `.${a.auditProperty}` : ''} on ${new URL(a.url).pathname} (${a.actual ?? '?'} vs ${a.operator ?? ''}${a.expected ?? ''})`
	return {
		pages,
		errors: failed.filter(a => a.level === 'error').map(describe),
		warnings: failed.filter(a => a.level !== 'error').map(describe),
	}
}

/** Pure: turns collected per-site data into a status + markdown + Slack text. Unit-tested. */
export function buildReport({ sites, jobs = {}, runUrl = '', date = new Date() }) {
	let overall = 'green'
	const md = []
	const slack = []
	const day = date.toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		timeZone: 'America/Santiago',
	})

	for (const s of sites) {
		let status = 'green'
		const lines = []
		const actions = []
		const host = new URL(s.baseUrl).host
		const t = s.technical

		// A crashed robots request must not claim the intended state was verified.
		const robotsUnknown =
			!t?.total ||
			t.otherErrors.some(e => /robots\.txt/.test(e)) ||
			t.failures.some(f => checkIdOf(f) === 'robots-served')
		// Mode / robots line
		const robotsChanged = t?.failures.some(f => checkIdOf(f) === 'robots-state')
		if (robotsUnknown) {
			lines.push(
				`Mode: *${s.robotsState === 'blocked' ? 'pre-launch' : 'live'}* — robots.txt state unverified`,
			)
		} else if (s.robotsState === 'blocked') {
			lines.push(
				robotsChanged
					? '🚨 *robots.txt changed* — sites.json says pre-launch (blocked) but crawlers are no longer fully blocked. Launch on purpose? Flip `robotsExpectedState` to `open`.'
					: 'Mode: *pre-launch* — robots.txt intentionally blocking crawlers ✅ (as expected)',
			)
		} else {
			lines.push(
				robotsChanged
					? '🚨 *robots.txt is blocking ALL crawlers* — the site cannot rank.'
					: 'Mode: *live* — crawlable ✅',
			)
		}

		// Technical
		if (t) {
			const newIssues = [...t.failures, ...t.otherErrors]
			if (newIssues.length) status = 'red'
			else if (t.warnings.length || t.fixedKnownIssues.length) status = worst(status, 'amber')
			lines.push(
				`• Technical: ${t.passed}/${t.total} tests passed · ${newIssues.length} new failure(s) · ${t.warnings.length} warning(s)${t.flaky ? ` · ${t.flaky} flaky (passed on retry)` : ''}`,
			)
			if (newIssues.length)
				actions.push(
					`❌ *Failing:* ${list(
						newIssues.map(x => x.split('\n')[0].slice(0, 160)),
						5,
					)}`,
				)
			if (t.warnings.length)
				actions.push(`⚠️ *Known issues / warnings:* ${list(t.warnings.map(checkIdOf))}`)
			if (t.fixedKnownIssues.length)
				actions.push(
					`🎉 *Fixed — remove from knownIssues:* ${list(t.fixedKnownIssues.map(checkIdOf))}`,
				)
		} else if (jobs.technical && jobs.technical !== 'skipped') {
			status = 'red'
			lines.push(`• Technical: ❌ no results — job ${jobs.technical} before producing output`)
		}

		// Lighthouse
		const lh = s.lighthouse
		if (lh) {
			if (lh.errors.length) status = 'red'
			else if (lh.warnings.length) status = worst(status, 'amber')
			const pages = lh.pages
				.map(
					p =>
						`${p.path} SEO ${score(p.seo)} · Perf ${score(p.performance)} · A11y ${score(p.accessibility)}`,
				)
				.join('  |  ')
			lines.push(
				`• Lighthouse (mobile, median of 3): ${pages || 'no pages'}${s.robotsState === 'blocked' ? ' _(SEO score capped while robots-blocked)_' : ''}`,
			)
			if (lh.errors.length) actions.push(`❌ *Lighthouse gates:* ${list(lh.errors, 4)}`)
			if (lh.warnings.length) actions.push(`⚠️ *Lighthouse warnings:* ${list(lh.warnings, 4)}`)
		} else if (jobs.lighthouse && jobs.lighthouse !== 'skipped') {
			status = 'red'
			lines.push(`• Lighthouse: ❌ no results — job ${jobs.lighthouse}`)
		}

		// Search Console
		const g = s.gsc
		if (g?.status === 'ok' || g?.status === 'cliff') {
			if (g.status === 'cliff') {
				status = 'red'
				actions.push(`❌ *Clicks dropped ${pct(g.clicksDeltaPct)} week-over-week*`)
			}
			lines.push(
				`• Search Console (${g.windows.current.startDate} → ${g.windows.current.endDate} vs prior 7d): clicks ${g.totals.clicks} (${pct(g.clicksDeltaPct)}) · impressions ${g.totals.impressions} (${pct(g.impressionsDeltaPct)}) · avg pos ${g.totals.position ? g.totals.position.toFixed(1) : '–'}`,
			)
			if (g.topQueries?.length)
				lines.push(
					`   Top queries: ${g.topQueries
						.slice(0, 3)
						.map(q => `${q.query} (#${q.position.toFixed(1)})`)
						.join(' · ')}`,
				)
			if (s.robotsState === 'blocked' && g.totals.impressions === 0)
				lines.push(
					'   _0 impressions is expected while blocked — this is the launch-day tripwire._',
				)
		} else if (g?.status === 'error') {
			status = 'red'
			lines.push(`• Search Console: ❌ API error — ${g.error}`)
		} else if (g?.status === 'skipped') {
			lines.push(`• Search Console: skipped (${g.reason})`)
		} else if (jobs.rankings && jobs.rankings !== 'skipped') {
			status = 'red'
			lines.push(`• Search Console: ❌ no results — job ${jobs.rankings}`)
		}

		overall = worst(overall, status)
		md.push(
			`### ${EMOJI[status]} ${s.name} (${host})`,
			'',
			...lines.map(l => l.replace(/^• /, '- ')),
			'',
			...actions.map(a => `- ${a}`),
			'',
		)
		slack.push(`${EMOJI[status]} *${s.name}* (${host})`, ...lines, ...actions, '')
	}

	const header = `${EMOJI[overall]} *SEO Pulse* — ${day}${runUrl ? ` · <${runUrl}|view run>` : ''}`
	return {
		status: overall,
		slackText: [header, '', ...slack].join('\n').slice(0, 3800),
		markdown: [
			`## ${EMOJI[overall]} SEO Pulse — ${day}`,
			'',
			...md,
			runUrl ? `[View run](${runUrl})` : '',
		].join('\n'),
	}
}

export function collect(outRoot, cfg, only = process.env.SEO_ONLY_SITE ?? '') {
	// Every enabled site is reported even when its folder is missing, so a crashed job shows up red.
	return cfg.sites
		.filter(s => s.enabled && (!only || s.id === only))
		.map(s => {
			const d = path.join(outRoot, s.id)
			const tech = readJson(path.join(d, 'technical-results.json'))
			return {
				id: s.id,
				name: s.name ?? s.id,
				baseUrl: s.baseUrl,
				robotsState: process.env.ROBOTS_EXPECTED_STATE || s.robotsExpectedState,
				technical: tech ? summarizeTechnical(tech) : null,
				lighthouse: summarizeLighthouse(
					readJson(path.join(d, 'lhci/reports/manifest.json')),
					readJson(path.join(d, 'lhci/assertion-results.json')),
				),
				gsc: readJson(path.join(d, 'gsc.json')),
			}
		})
}

export function jobResults(needsJson = process.env.NEEDS_JSON ?? '{}') {
	try {
		const needs = JSON.parse(needsJson)
		return Object.fromEntries(
			Object.entries(needs).map(([k, v]) => [k.replace(/^seo-/, ''), v.result]),
		)
	} catch {
		return {}
	}
}

async function main() {
	const dryRun = process.argv.includes('--dry-run')
	const outRoot = path.resolve(process.env.SEO_OUT_ROOT ?? 'seo/out')
	const cfg = loadConfig()
	const report = buildReport({
		sites: collect(outRoot, cfg),
		jobs: jobResults(),
		runUrl: process.env.RUN_URL ?? '',
	})

	mkdirSync(outRoot, { recursive: true })
	writeFileSync(path.join(outRoot, 'report.md'), report.markdown)
	if (process.env.GITHUB_STEP_SUMMARY)
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report.markdown}\n`)

	const webhook = process.env.SLACK_WEBHOOK_URL
	if (dryRun || process.env.POST_TO_SLACK !== 'true') {
		console.log(report.slackText)
		if (!dryRun && !webhook) console.log('\n(SLACK_WEBHOOK_URL not set — not posted)')
		return 0
	}
	if (!webhook) throw new Error('SLACK_WEBHOOK_URL is required when POST_TO_SLACK=true')
	const res = await fetch(webhook, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ text: report.slackText }),
		signal: AbortSignal.timeout(20000),
	})
	if (!res.ok) {
		console.error(`Slack post failed: HTTP ${res.status} ${await res.text()}`)
		return 1
	}
	console.log(`Posted ${report.status} SEO digest to Slack.`)
	return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main()
		.then(code => process.exit(code))
		.catch(() => {
			console.error('SEO digest delivery failed; see report.md for the generated report.')
			process.exitCode = 1
		})
}
