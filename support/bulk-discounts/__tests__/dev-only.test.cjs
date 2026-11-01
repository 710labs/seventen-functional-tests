const { test } = require('node:test')
const assert = require('node:assert/strict')
const { DEV_ORIGIN, assertDevUrl, assertDevBaseUrl } = require('../dev-only.cjs')

test('only the exact HTTPS dev origin can be configured', () => {
	assert.equal(assertDevBaseUrl(DEV_ORIGIN), DEV_ORIGIN)
	assert.equal(assertDevBaseUrl(`${DEV_ORIGIN}/`), DEV_ORIGIN)
	assert.equal(assertDevUrl(`${DEV_ORIGIN}/wp-json/wc/store/v1/cart`).origin, DEV_ORIGIN)
})

for (const value of [
	undefined, '', 'https://thelist.710labs.com', 'https://thelist-stage.710labs.com',
	'http://thelist-dev.710labs.com', 'https://thelist-dev.710labs.com:8443',
	'https://thelist-dev.710labs.com.example.org', 'https://thelist-dev.710labs.com@evil.example',
	'https://user:password@thelist-dev.710labs.com', 'https://thelist-dev.710labs.com.',
	'https://thelist-dev.710labs.com/#fragment', 'https://127.0.0.1',
]) {
	test(`reject unsafe target ${String(value)}`, () => assert.throws(() => assertDevBaseUrl(value)))
}

test('base paths and queries cannot override routing', () => {
	assert.throws(() => assertDevBaseUrl(`${DEV_ORIGIN}/wp-json`))
	assert.throws(() => assertDevBaseUrl(`${DEV_ORIGIN}/?redirect=elsewhere`))
})
