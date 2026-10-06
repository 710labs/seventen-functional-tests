#!/usr/bin/env node
/**
 * Daily Google Search Console pull for one site (free, read-only service account).
 *
 * Env:
 *   SEO_SITE                  site id from seo/config/sites.json (uses its `gsc` block)
 *   GSC_SERVICE_ACCOUNT_KEY   JSON key of a service account added as a user on the GSC property
 *   SEO_OUT_DIR               output dir (default seo/out/<site>)
 *
 * Writes <out>/gsc.json. Exit codes: 0 ok / skipped, 1 clicks cliff (WoW drop beyond threshold),
 * 2 API/auth error (so a broken credential is visible, not silently "0 clicks").
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadConfig, resolveSite } from '../lib/config.mjs'

const DAY = 86_400_000
const iso = d => d.toISOString().slice(0, 10)

/** GSC data lags ~2–3 days: compare the latest complete 7 days with the 7 before it. */
export function windows(now = new Date()) {
	const end = new Date(now.getTime() - 3 * DAY)
	return {
		current: { startDate: iso(new Date(end.getTime() - 6 * DAY)), endDate: iso(end) },
		previous: {
			startDate: iso(new Date(end.getTime() - 13 * DAY)),
			endDate: iso(new Date(end.getTime() - 7 * DAY)),
		},
	}
}

export const pctChange = (now, prev) =>
	prev === 0 ? (now === 0 ? 0 : null) : ((now - prev) / prev) * 100

export function evaluate({ totals, previousTotals, cliffPct = 40, minBaseline = 20 }) {
	const clicksDeltaPct = pctChange(totals.clicks, previousTotals.clicks)
	const impressionsDeltaPct = pctChange(totals.impressions, previousTotals.impressions)
	const cliff =
		previousTotals.clicks >= minBaseline && clicksDeltaPct !== null && clicksDeltaPct <= -cliffPct
	return { clicksDeltaPct, impressionsDeltaPct, cliff }
}

const ZERO = { clicks: 0, impressions: 0, ctr: 0, position: null }

async function main() {
	const cfg = loadConfig()
	const site = resolveSite(cfg)
	const outDir = path.resolve(process.env.SEO_OUT_DIR ?? `seo/out/${site.id}`)
	mkdirSync(outDir, { recursive: true })
	const write = obj =>
		writeFileSync(path.join(outDir, 'gsc.json'), JSON.stringify({ site: site.id, ...obj }, null, 2))

	if (!site.gsc?.property) {
		write({ status: 'skipped', reason: 'no gsc block for this site in sites.json' })
		console.log(`GSC: skipped (${site.id} has no gsc config)`)
		return 0
	}
	const keyJson = process.env.GSC_SERVICE_ACCOUNT_KEY
	if (!keyJson) {
		write({ status: 'skipped', reason: 'GSC_SERVICE_ACCOUNT_KEY secret not configured' })
		console.log('GSC: skipped (GSC_SERVICE_ACCOUNT_KEY not set)')
		return 0
	}

	try {
		const { google } = await import('googleapis')
		const key = JSON.parse(keyJson)
		const auth = new google.auth.JWT({
			email: key.client_email,
			key: key.private_key,
			scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
		})
		const sc = google.searchconsole({ version: 'v1', auth })
		const filter = site.gsc.pageContains
			? [
					{
						filters: [
							{ dimension: 'page', operator: 'contains', expression: site.gsc.pageContains },
						],
					},
				]
			: undefined
		const q = async (range, dimensions = [], rowLimit = 10) =>
			(
				await sc.searchanalytics.query({
					siteUrl: site.gsc.property,
					requestBody: {
						...range,
						dimensions,
						rowLimit,
						dimensionFilterGroups: filter,
						dataState: 'final',
					},
				})
			).data.rows ?? []

		const w = windows()
		const [[cur], [prev], topQueries, topPages] = await Promise.all([
			q(w.current, [], 1),
			q(w.previous, [], 1),
			q(w.current, ['query'], 10),
			q(w.current, ['page'], 25),
		])
		const totals = cur ?? ZERO
		const previousTotals = prev ?? ZERO
		const verdict = evaluate({
			totals,
			previousTotals,
			cliffPct: cfg.defaults?.gscClicksCliffPct ?? 40,
			minBaseline: cfg.defaults?.gscClicksCliffMinBaseline ?? 20,
		})
		write({
			status: verdict.cliff ? 'cliff' : 'ok',
			property: site.gsc.property,
			pageContains: site.gsc.pageContains ?? null,
			windows: w,
			totals,
			previousTotals,
			...verdict,
			topQueries: topQueries.map(r => ({
				query: r.keys[0],
				clicks: r.clicks,
				impressions: r.impressions,
				position: r.position,
			})),
			productPagesWithImpressions: topPages.filter(
				r => r.keys[0].includes('/product/') && r.impressions > 0,
			).length,
		})
		console.log(
			`GSC ${site.id}: clicks ${totals.clicks} (prev ${previousTotals.clicks}), impressions ${totals.impressions}`,
		)
		return verdict.cliff ? 1 : 0
	} catch (err) {
		write({ status: 'error', error: String(err?.message ?? err).slice(0, 500) })
		console.error(`GSC error: ${err?.message ?? err}`)
		return 2
	}
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().then(code => process.exit(code))
}
