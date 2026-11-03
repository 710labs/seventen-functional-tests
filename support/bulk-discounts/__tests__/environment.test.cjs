const { test } = require('node:test')
const assert = require('node:assert/strict')
const { BULK_ORIGINS, assertBulkBaseUrl, assertBulkNavigationUrl } = require('../environment.cjs')

for (const origin of BULK_ORIGINS) {
	test(`browser scenarios accept ${origin} and stay within that environment`, () => {
		assert.equal(assertBulkBaseUrl(origin), origin)
		assert.equal(assertBulkBaseUrl(`${origin}/`), origin)
		assert.equal(assertBulkNavigationUrl(`${origin}/checkout/?order=123`, origin).origin, origin)
		const otherOrigin = BULK_ORIGINS.find(value => value !== origin)
		assert.throws(() => assertBulkNavigationUrl(`${otherOrigin}/cart/`, origin), /BULK_CROSS_ENVIRONMENT/)
		for (const suffix of ['/cart/', '/?redirect=elsewhere', '/#fragment']) {
			assert.throws(() => assertBulkBaseUrl(`${origin}${suffix}`))
		}
	})
}

for (const value of [
	undefined, '', 'https://thelist.710labs.com', 'https://127.0.0.1',
	...BULK_ORIGINS.flatMap(origin => [
		origin.replace('https:', 'http:'), `${origin}:8443`, `${origin}.example.org`,
		`${origin}@evil.example`, origin.replace('https://', 'https://user:password@'), `${origin}.`,
	]),
]) {
	test(`browser scenarios reject unsafe target ${String(value)}`, () => {
		assert.throws(() => assertBulkBaseUrl(value))
		assert.throws(() => assertBulkNavigationUrl(value, BULK_ORIGINS[0]))
		assert.throws(() => assertBulkNavigationUrl(`${BULK_ORIGINS[0]}/cart/`, value))
	})
}
