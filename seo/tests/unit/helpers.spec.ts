// Unit tests for the pure helpers and config loader (no browser, no network).
import { test, expect } from '@playwright/test'
import {
	robotsBlocksEverything,
	robotsSitemapUrls,
	parseRobots,
	jsonLdTypes,
	findJsonLdNode,
	pickRotatingSample,
	uniqueSameOriginUrls,
} from '../../lib/seo-helpers.mjs'
import { validateConfig, resolveSite, enabledSites, loadConfig } from '../../lib/config.mjs'

test.describe('robotsBlocksEverything', () => {
	test('production pre-launch file blocks everything', () => {
		expect(robotsBlocksEverything('User-agent: *\nDisallow: /\n')).toBe(true)
	})
	test('CRLF, comments and spacing are tolerated', () => {
		expect(robotsBlocksEverything('# staging\r\nUser-agent:*\r\nDisallow:   /   # all\r\n')).toBe(
			true,
		)
	})
	test('typical WordPress open file does not block', () => {
		const wp =
			'User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n\nSitemap: https://x.com/wp-sitemap.xml'
		expect(robotsBlocksEverything(wp)).toBe(false)
	})
	test('empty Disallow means allow all', () => {
		expect(robotsBlocksEverything('User-agent: *\nDisallow:\n')).toBe(false)
	})
	test('blocking only a specific bot does not count as a full block', () => {
		expect(
			robotsBlocksEverything('User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /cart/'),
		).toBe(false)
	})
	test('multi-agent group including * is honoured', () => {
		expect(robotsBlocksEverything('User-agent: Googlebot\nUser-agent: *\nDisallow: /')).toBe(true)
	})
	test('Allow: / re-opens the root', () => {
		expect(robotsBlocksEverything('User-agent: *\nDisallow: /\nAllow: /')).toBe(false)
	})
	test('missing / empty file does not block', () => {
		expect(robotsBlocksEverything('')).toBe(false)
		expect(robotsBlocksEverything(undefined as unknown as string)).toBe(false)
	})
	test('parseRobots splits groups on new user-agent after rules', () => {
		const g = parseRobots('User-agent: a\nDisallow: /x\nUser-agent: b\nDisallow: /y')
		expect(g).toHaveLength(2)
	})
	test('sitemap lines are extracted', () => {
		expect(
			robotsSitemapUrls('User-agent: *\nSitemap: https://a.com/s.xml\nsitemap:https://a.com/t.xml'),
		).toEqual(['https://a.com/s.xml', 'https://a.com/t.xml'])
	})
})

test.describe('JSON-LD helpers', () => {
	const live = [[{ '@type': 'Product', name: 'Cereal Star #5' }, { '@type': 'BreadcrumbList' }]]
	test('types from nested arrays', () => {
		expect(jsonLdTypes(live)).toEqual(['Product', 'BreadcrumbList'])
	})
	test('types from @graph (Yoast/RankMath style)', () => {
		expect(
			jsonLdTypes({ '@graph': [{ '@type': 'WebSite' }, { '@type': ['Organization', 'Brand'] }] }),
		).toEqual(['WebSite', 'Organization', 'Brand'])
	})
	test('findJsonLdNode finds Product in arrays and graphs', () => {
		expect(findJsonLdNode(live, 'Product')?.name).toBe('Cereal Star #5')
		expect(findJsonLdNode({ '@graph': [{ '@type': 'Product', name: 'x' }] }, 'Product')?.name).toBe(
			'x',
		)
		expect(findJsonLdNode(live, 'Organization')).toBeUndefined()
	})
	test('garbage input is safe', () => {
		expect(jsonLdTypes(null)).toEqual([])
		expect(jsonLdTypes('x' as unknown as object)).toEqual([])
	})
})

test.describe('pickRotatingSample', () => {
	const items = Array.from({ length: 12 }, (_, i) => i)
	test('returns the requested size', () => {
		expect(pickRotatingSample(items, 5, 3)).toHaveLength(5)
	})
	test('is deterministic for a seed', () => {
		expect(pickRotatingSample(items, 5, 7)).toEqual(pickRotatingSample(items, 5, 7))
	})
	test('covers the whole catalog over consecutive days', () => {
		const seen = new Set<number>()
		for (let day = 0; day < Math.ceil(items.length / 5) + 1; day++)
			pickRotatingSample(items, 5, day).forEach(x => seen.add(x))
		expect(seen.size).toBe(items.length)
	})
	test('small lists are returned whole; bad sizes return empty', () => {
		expect(pickRotatingSample([1, 2], 5, 9)).toEqual([1, 2])
		expect(pickRotatingSample(items, 0, 1)).toEqual([])
	})
})

test.describe('uniqueSameOriginUrls', () => {
	test('dedupes, strips hash/query, drops other origins', () => {
		const out = uniqueSameOriginUrls(
			[
				'https://live.710labs.com/product/a/',
				'https://live.710labs.com/product/a/#reviews',
				'https://live.710labs.com/product/a/?utm=x',
				'https://shop.710labs.com/product/b/',
				'not a url',
			],
			'https://live.710labs.com',
		)
		expect(out).toEqual(['https://live.710labs.com/product/a/'])
	})
})

test.describe('config', () => {
	const base = {
		defaults: { thresholds: { maxTitleLength: 60 } },
		sites: [
			{
				id: 'a',
				baseUrl: 'https://a.com',
				canonicalHost: 'a.com',
				enabled: true,
				robotsExpectedState: 'blocked',
				keyPages: ['/'],
				productListPath: '/',
				productLinkSelector: 'a',
			},
			{
				id: 'b',
				baseUrl: 'https://b.com',
				canonicalHost: 'b.com',
				enabled: false,
				robotsExpectedState: 'open',
				keyPages: ['/'],
				productListPath: '/',
				productLinkSelector: 'a',
			},
		],
	}
	test('valid config passes', () => expect(() => validateConfig(base)).not.toThrow())
	test('invalid robots state and trailing slash are rejected', () => {
		const bad = structuredClone(base)
		bad.sites[0].robotsExpectedState = 'maybe'
		bad.sites[0].baseUrl = 'https://a.com/'
		expect(() => validateConfig(bad)).toThrow(/robotsExpectedState[\s\S]*trailing|baseUrl/)
	})
	test('resolveSite picks first enabled site and applies env overrides', () => {
		const s = resolveSite(base, {
			SEO_BASE_URL: 'http://127.0.0.1:9/',
			ROBOTS_EXPECTED_STATE: 'open',
		} as NodeJS.ProcessEnv)
		expect(s.id).toBe('a')
		expect(s.baseUrl).toBe('http://127.0.0.1:9')
		expect(s.robotsExpectedState).toBe('open')
		expect(s.thresholds.maxTitleLength).toBe(60)
	})
	test('resolveSite rejects unknown site and bad override', () => {
		expect(() => resolveSite(base, { SEO_SITE: 'zzz' } as NodeJS.ProcessEnv)).toThrow(/Unknown/)
		expect(() => resolveSite(base, { ROBOTS_EXPECTED_STATE: 'x' } as NodeJS.ProcessEnv)).toThrow()
	})
	test('enabledSites filters disabled sites', () => {
		expect(enabledSites(base).map((s: { id: string }) => s.id)).toEqual(['a'])
		expect(() => enabledSites(base, 'b')).toThrow(/not an enabled site/)
	})
	test('the real repo config is valid', () => {
		// loadConfig() validates on load and throws on any schema problem.
		expect(() => loadConfig('seo/config/sites.json')).not.toThrow()
	})
})
