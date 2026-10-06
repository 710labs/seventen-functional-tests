/**
 * Daily SEO pulse — technical & product-visibility checks for ONE site (SEO_SITE).
 * The workflow runs this once per enabled site via a matrix.
 *
 * Every check() call has a stable id. Ids in the site's `knownIssues` warn instead of fail.
 * Hard navigation problems (HTTP ≥400, empty product grid) always fail — those are outages.
 */
import { test, expect, type Page } from '@playwright/test'
import { resolveSite } from '../lib/config.mjs'
import { makeChecker, info } from '../lib/checks.mjs'
import {
	robotsBlocksEverything,
	robotsSitemapUrls,
	jsonLdTypes,
	findJsonLdNode,
	pickRotatingSample,
	dayIndex,
	uniqueSameOriginUrls,
} from '../lib/seo-helpers.mjs'

const site = resolveSite()
const T = site.thresholds
const check = makeChecker(site)
const blocked = site.robotsExpectedState === 'blocked'

test.describe(`SEO pulse · ${site.id} (${site.robotsExpectedState})`, () => {
	test('robots.txt matches the intended state', async ({ request }, testInfo) => {
		const res = await request.get(`${site.baseUrl}/robots.txt`)
		check(
			testInfo,
			'robots-served',
			res.status() === 200,
			`robots.txt returned HTTP ${res.status()}`,
		)
		const body = await res.text()
		const blocksAll = robotsBlocksEverything(body)

		if (blocked) {
			// Pre-launch: the full block is a deliberate decision. Alert if it changes without one.
			check(
				testInfo,
				'robots-state',
				blocksAll,
				`robots.txt no longer fully blocks crawlers, but sites.json says "blocked". If launch happened, flip robotsExpectedState to "open". Current robots.txt: ${oneLine(body)}`,
			)
		} else {
			check(
				testInfo,
				'robots-state',
				!blocksAll,
				`robots.txt blocks ALL crawlers — the site cannot rank. Current robots.txt: ${oneLine(body)}`,
			)
			check(
				testInfo,
				'robots-sitemap-ref',
				robotsSitemapUrls(body).length > 0,
				'robots.txt has no "Sitemap:" line',
			)
		}
	})

	test('sitemap.xml is present and valid', async ({ request }, testInfo) => {
		const res = await request.get(`${site.baseUrl}/sitemap.xml`)
		const text = res.ok() ? await res.text() : ''
		const valid = res.ok() && /<(urlset|sitemapindex)[\s>]/.test(text)
		// Only a launch-readiness gap while blocked; a hard requirement once open.
		check(
			testInfo,
			'sitemap-present',
			valid,
			`sitemap.xml HTTP ${res.status()}${res.ok() && !valid ? ' (not a valid sitemap)' : ''}`,
			{ warnOnly: blocked },
		)
	})

	for (const pagePath of site.keyPages) {
		test(`on-page SEO: ${pagePath}`, async ({ page }, testInfo) => {
			const res = await page.goto(site.baseUrl + pagePath, { waitUntil: 'domcontentloaded' })
			const status = res?.status() ?? 0
			expect(status, `${pagePath} returned HTTP ${status}`).toBeLessThan(400) // outage, never a warning

			const d = await collectPageSeo(page, T.minImageWidthForAlt)
			const finalPath = new URL(page.url()).pathname

			check(
				testInfo,
				`no-noindex:${pagePath}`,
				!/noindex/i.test(d.robotsMeta),
				`meta robots contains noindex ("${d.robotsMeta}")`,
			)
			check(
				testInfo,
				`x-robots-tag:${pagePath}`,
				!/noindex/i.test(res?.headers()['x-robots-tag'] ?? ''),
				`X-Robots-Tag header contains noindex`,
			)

			check(
				testInfo,
				`title:${pagePath}`,
				d.title.length >= T.minTitleLength && d.title.length <= T.maxTitleLength,
				`title length ${d.title.length} outside ${T.minTitleLength}–${T.maxTitleLength}: "${d.title}"`,
			)

			check(
				testInfo,
				`meta-description:${pagePath}`,
				d.description.length >= T.minMetaDescriptionLength &&
					d.description.length <= T.maxMetaDescriptionLength,
				d.description
					? `meta description length ${d.description.length} outside ${T.minMetaDescriptionLength}–${T.maxMetaDescriptionLength}`
					: 'missing meta description',
			)

			const canon = safeUrl(d.canonical)
			check(
				testInfo,
				`canonical:${pagePath}`,
				!!canon && canon.host === site.canonicalHost && canon.pathname === finalPath,
				canon
					? `canonical ${d.canonical} is not self-referencing (expected host ${site.canonicalHost}, path ${finalPath})`
					: 'missing or relative canonical',
			)

			check(
				testInfo,
				`single-h1:${pagePath}`,
				d.h1s.length === 1,
				`expected 1 <h1>, found ${d.h1s.length}: ${JSON.stringify(d.h1s.slice(0, 6))}`,
			)

			check(
				testInfo,
				`img-alt:${pagePath}`,
				d.imagesMissingAlt.length === 0,
				`${d.imagesMissingAlt.length} image(s) missing alt text: ${d.imagesMissingAlt.slice(0, 8).join(', ')}`,
			)

			check(testInfo, `html-lang:${pagePath}`, !!d.lang, 'missing <html lang>')

			check(
				testInfo,
				`jsonld-parse:${pagePath}`,
				d.jsonLdParseErrors === 0,
				`${d.jsonLdParseErrors} JSON-LD block(s) failed to parse`,
			)

			if (site.organizationSchemaPages.includes(pagePath)) {
				const types = jsonLdTypes(d.jsonLd)
				check(
					testInfo,
					`org-schema:${pagePath}`,
					types.includes('Organization') || types.includes('WebSite'),
					`no Organization/WebSite JSON-LD (found: ${types.join(', ') || 'none'})`,
				)
			}
		})
	}

	test('product pages: schema + unique metadata (rotating daily sample)', async ({
		page,
	}, testInfo) => {
		test.setTimeout(240_000)
		const res = await page.goto(site.baseUrl + site.productListPath, {
			waitUntil: 'domcontentloaded',
		})
		expect(
			res?.status() ?? 0,
			`${site.productListPath} returned HTTP ${res?.status()}`,
		).toBeLessThan(400)

		// Live hydrates the product grid after DOMContentLoaded. Wait for real links,
		// while keeping a genuinely empty grid a hard outage.
		await expect
			.poll(() => page.locator(site.productLinkSelector).count(), {
				timeout: 15000,
				message: `no product links found on ${site.productListPath} — product grid may be broken`,
			})
			.toBeGreaterThan(0)

		const hrefs = await page.$$eval(site.productLinkSelector, as =>
			as.map(a => (a as HTMLAnchorElement).href),
		)
		const urls = uniqueSameOriginUrls(hrefs, site.baseUrl)
		// An empty grid is an outage (inventory/sync broke), not an SEO nit — always hard-fail.
		expect(
			urls.length,
			`no product links found on ${site.productListPath} — product grid may be broken`,
		).toBeGreaterThan(0)

		const seed = Number(process.env.SEO_ROTATION_SEED ?? dayIndex())
		const sample = pickRotatingSample(urls, site.productSampleSize, seed)
		info(
			testInfo,
			`product sample ${sample.length}/${urls.length} (seed ${seed}): ${sample.map(u => new URL(u).pathname).join(', ')}`,
		)

		const titles = new Map<string, string>()
		const descs = new Map<string, string>()

		for (const url of sample) {
			const p = new URL(url).pathname
			await test.step(p, async () => {
				const r = await page.goto(url, { waitUntil: 'domcontentloaded' })
				if (
					!check(testInfo, `product-status:${p}`, (r?.status() ?? 0) < 400, `HTTP ${r?.status()}`)
				)
					return
				const d = await collectPageSeo(page, T.minImageWidthForAlt)

				check(
					testInfo,
					`product-title:${p}`,
					d.title.length >= T.minTitleLength,
					`missing/short title "${d.title}"`,
				)
				if (d.title && titles.has(d.title))
					check(
						testInfo,
						`product-title-unique:${p}`,
						false,
						`duplicate title "${d.title}" (also on ${titles.get(d.title)})`,
					)
				titles.set(d.title, p)

				check(
					testInfo,
					`product-meta-description:${p}`,
					d.description.length >= T.minMetaDescriptionLength,
					'missing/short meta description',
				)
				if (d.description && descs.has(d.description))
					check(
						testInfo,
						`product-description-unique:${p}`,
						false,
						`duplicate meta description (also on ${descs.get(d.description)})`,
					)
				descs.set(d.description, p)

				check(
					testInfo,
					`product-canonical:${p}`,
					!!safeUrl(d.canonical),
					'missing or relative canonical',
				)
				check(
					testInfo,
					`product-noindex:${p}`,
					!/noindex/i.test(d.robotsMeta),
					`meta robots contains noindex ("${d.robotsMeta}")`,
				)

				const types = jsonLdTypes(d.jsonLd)
				const product = findJsonLdNode(d.jsonLd, 'Product') as Record<string, unknown> | undefined
				if (
					check(
						testInfo,
						`product-schema:${p}`,
						!!product,
						`missing Product JSON-LD (found: ${types.join(', ') || 'none'})`,
					)
				) {
					check(
						testInfo,
						`product-schema-name:${p}`,
						!!product!.name,
						'Product schema missing "name"',
					)
					check(
						testInfo,
						`product-schema-image:${p}`,
						!!product!.image,
						'Product schema missing "image"',
					)
					check(
						testInfo,
						`product-schema-description:${p}`,
						!!product!.description,
						'Product schema missing "description"',
					)
					// Offers are location-dependent on Live, so recommended-not-required.
					check(
						testInfo,
						`product-schema-offers:${p}`,
						!!product!.offers,
						'Product schema has no "offers" (recommended for rich results)',
						{ warnOnly: true },
					)
				}
				check(
					testInfo,
					`product-breadcrumb:${p}`,
					types.includes('BreadcrumbList'),
					'missing BreadcrumbList JSON-LD',
				)
			})
		}
	})
})

// ---------------------------------------------------------------------------

type PageSeo = {
	title: string
	description: string
	robotsMeta: string
	canonical: string
	lang: string
	h1s: string[]
	imagesMissingAlt: string[]
	jsonLd: unknown[]
	jsonLdParseErrors: number
}

async function collectPageSeo(page: Page, minImageWidth: number): Promise<PageSeo> {
	return page.evaluate(minW => {
		const meta = (sel: string) =>
			document.querySelector<HTMLMetaElement>(sel)?.content?.trim() ?? ''
		let parseErrors = 0
		const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
			.map(s => {
				try {
					return JSON.parse(s.textContent ?? '')
				} catch {
					parseErrors++
					return null
				}
			})
			.filter(Boolean)
		const imagesMissingAlt = [...document.images]
			.filter(img => {
				if (
					img.getAttribute('role') === 'presentation' ||
					img.getAttribute('aria-hidden') === 'true'
				)
					return false
				const w = img.width || Number(img.getAttribute('width')) || 0
				if (w > 0 && w < minW) return false // tracking pixels / tiny icons
				return !(img.getAttribute('alt') ?? '').trim()
			})
			.map(
				img =>
					(img.currentSrc || img.src || img.getAttribute('data-src') || '').split('/').pop() ||
					'(no src)',
			)
		return {
			title: document.title.trim(),
			description: meta('meta[name="description"]'),
			robotsMeta: meta('meta[name="robots"]'),
			canonical:
				document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href') ??
				'',
			lang: document.documentElement.lang,
			h1s: [...document.querySelectorAll('h1')].map(h =>
				(h.textContent ?? '').trim().replace(/\s+/g, ' '),
			),
			imagesMissingAlt,
			jsonLd,
			jsonLdParseErrors: parseErrors,
		}
	}, minImageWidth)
}

function safeUrl(href: string): URL | null {
	try {
		return href ? new URL(href) : null
	} catch {
		return null
	}
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 300)
