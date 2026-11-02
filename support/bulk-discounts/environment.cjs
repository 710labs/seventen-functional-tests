// Browser scenarios run on these two environments only. The API probe remains dev-only.
const BULK_ORIGINS = Object.freeze([
	'https://thelist-dev.710labs.com',
	'https://thelist-stage.710labs.com',
])

function parseBulkUrl(value) {
	let url
	try { url = new URL(value) } catch { throw new Error('BULK_URL_REQUIRED') }
	if (!BULK_ORIGINS.includes(url.origin) || url.username || url.password || url.hash) {
		throw new Error('BULK_DEV_OR_STAGE_ONLY')
	}
	return url
}

function assertBulkBaseUrl(value) {
	const url = parseBulkUrl(value)
	if (url.pathname !== '/' || url.search) throw new Error('BULK_BASE_MUST_BE_ORIGIN')
	return url.origin
}

function assertBulkNavigationUrl(value, baseUrl) {
	const targetOrigin = assertBulkBaseUrl(baseUrl)
	const url = parseBulkUrl(value)
	if (url.origin !== targetOrigin) throw new Error('BULK_CROSS_ENVIRONMENT_NAVIGATION')
	return url
}

module.exports = { BULK_ORIGINS, assertBulkBaseUrl, assertBulkNavigationUrl }
