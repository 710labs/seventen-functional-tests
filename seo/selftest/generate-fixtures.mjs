#!/usr/bin/env node
// Regenerates the static self-test fixture sites in seo/selftest/fixtures/.
// The generated files ARE committed; re-run only when changing a fixture:
//   node seo/selftest/generate-fixtures.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')
rmSync(root, { recursive: true, force: true })

const put = (site, rel, body) => {
	const f = path.join(root, site, rel)
	mkdirSync(path.dirname(f), { recursive: true })
	writeFileSync(f, body)
}

const page = ({
	title,
	desc,
	canonical,
	h1s = [],
	imgs = [],
	jsonld = [],
	links = [],
	robots = 'max-image-preview:large',
	lang = 'en',
}) => `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8">
<title>${title}</title>
${desc ? `<meta name="description" content="${desc}">` : ''}
<meta name="robots" content="${robots}">
${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head><body>
${h1s.map(h => `<h1>${h}</h1>`).join('\n')}
${imgs.map(i => `<img src="/img/${i.src}" width="${i.w ?? 200}" height="200"${i.alt !== undefined ? ` alt="${i.alt}"` : ''}>`).join('\n')}
${links.map(l => `<a href="${l}">${l}</a>`).join('\n')}
<img src="/px.gif" width="1" height="1">
</body></html>
`

const C = 'https://live.710labs.com'
const BLOCKED = 'User-agent: *\nDisallow: /\n'
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${C}/shop/</loc></url></urlset>\n`
const SHOP_TITLE = 'Shop 710 Labs Near You | 710 Labs'
const SHOP_DESC =
	'Order 710 Labs for pickup or delivery from trusted dispensaries near you. Live now in CA, CO, MI, & NJ.'
const pdesc = n =>
	`${n} Live Rosin Disposable from 710 Labs. Check availability for pickup or delivery near you.`

const product = (slug, name, extra = {}) =>
	page({
		title: `${name} | 710 Labs`,
		desc: pdesc(name),
		canonical: `${C}/product/${slug}/`,
		h1s: [name],
		imgs: [{ src: `${slug}.png`, alt: name }],
		jsonld: [
			[
				{
					'@type': 'Product',
					name,
					image: `${C}/img/${slug}.png`,
					description: 'Live Rosin Disposable',
					offers: { '@type': 'Offer', priceCurrency: 'USD', price: '45' },
				},
				{ '@type': 'BreadcrumbList', itemListElement: [] },
			],
		],
		...extra,
	})

const learn = page({
	title: 'Learn about Live Rosin | 710 Labs',
	desc: 'Guides to solventless live rosin, strains, and how to choose the right 710 Labs product for you.',
	canonical: `${C}/learn/`,
	h1s: ['Learn'],
	imgs: [{ src: 'learn.png', alt: 'Rosin press' }],
})

// Includes a duplicate (#hash) and an off-origin link to exercise URL normalisation.
const shopLinks = [
	'/product/cereal-star-5/',
	'/product/gak-smoovie-5/',
	'/product/rambutan-11/',
	'/product/cereal-star-5/#reviews',
	'https://shop.710labs.com/product-merch/',
]
const products = [
	['cereal-star-5', 'Cereal Star #5'],
	['gak-smoovie-5', 'Gak Smoovie #5'],
	['rambutan-11', 'Rambutan #11'],
]

// 1) good — fully compliant pre-launch site. Every check passes, zero warnings.
put('good', 'robots.txt', BLOCKED)
put('good', 'sitemap.xml', SITEMAP)
put(
	'good',
	'shop/index.html',
	page({
		title: SHOP_TITLE,
		desc: SHOP_DESC,
		canonical: `${C}/shop/`,
		h1s: ['710 Labs: Live'],
		imgs: [{ src: 'a.png', alt: 'Persy Badder jar' }],
		jsonld: [
			{
				'@graph': [
					{ '@type': 'Organization', name: '710 Labs' },
					{ '@type': 'WebSite', name: '710 Labs Live' },
				],
			},
		],
		links: shopLinks,
	}),
)
put('good', 'learn/index.html', learn)
for (const [s, n] of products) put('good', `product/${s}/index.html`, product(s, n))

// 2) prodmirror — mirrors production as audited 2026-08: 5 H1s, no JSON-LD, images missing alt, no sitemap.
put('prodmirror', 'robots.txt', BLOCKED)
put(
	'prodmirror',
	'shop/index.html',
	page({
		title: SHOP_TITLE,
		desc: SHOP_DESC,
		canonical: `${C}/shop/`,
		h1s: [
			'710 Labs: Live',
			'Shop by Store',
			'Shop by Category',
			'Live Rosin Disposable',
			'Close Friends',
		],
		imgs: [{ src: 'a.png' }, { src: 'b.png' }, { src: 'c.png', alt: 'Persy Rosin' }],
		links: shopLinks,
	}),
)
put('prodmirror', 'learn/index.html', learn)
for (const [s, n] of products) put('prodmirror', `product/${s}/index.html`, product(s, n))

// 3) regressed — product-level regressions: duplicate title/meta, missing Product schema, stray noindex.
put('regressed', 'robots.txt', BLOCKED)
put('regressed', 'sitemap.xml', SITEMAP)
put(
	'regressed',
	'shop/index.html',
	page({
		title: SHOP_TITLE,
		desc: SHOP_DESC,
		canonical: `${C}/shop/`,
		h1s: ['710 Labs: Live'],
		imgs: [{ src: 'a.png', alt: 'Persy Badder jar' }],
		jsonld: [{ '@type': 'Organization', name: '710 Labs' }],
		links: shopLinks,
	}),
)
put('regressed', 'learn/index.html', learn)
put('regressed', 'product/cereal-star-5/index.html', product('cereal-star-5', 'Cereal Star #5'))
put(
	'regressed',
	'product/gak-smoovie-5/index.html',
	product('gak-smoovie-5', 'Cereal Star #5', { canonical: `${C}/product/gak-smoovie-5/` }),
)
put(
	'regressed',
	'product/rambutan-11/index.html',
	page({
		title: 'Rambutan #11 | 710 Labs',
		desc: pdesc('Rambutan #11'),
		canonical: `${C}/product/rambutan-11/`,
		h1s: ['Rambutan #11'],
		robots: 'noindex, follow',
		jsonld: [{ '@type': 'BreadcrumbList' }],
	}),
)

// 4) outage — empty product grid and a key page that 404s. These must hard-fail even if listed as known issues.
put('outage', 'robots.txt', BLOCKED)
put('outage', 'sitemap.xml', SITEMAP)
put(
	'outage',
	'shop/index.html',
	page({
		title: SHOP_TITLE,
		desc: SHOP_DESC,
		canonical: `${C}/shop/`,
		h1s: ['710 Labs: Live'],
		jsonld: [{ '@type': 'Organization', name: '710 Labs' }],
	}),
)
// (intentionally no learn/ page → 404)

console.log(`fixtures written to ${root}`)
