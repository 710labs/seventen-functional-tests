// Intentionally not configurable through an environment allowlist.
const DEV_ORIGIN = 'https://thelist-dev.710labs.com'

function assertDevUrl(value) {
	let url
	try { url = new URL(value) } catch { throw new Error('BULK_DEV_URL_REQUIRED') }
	if (url.origin !== DEV_ORIGIN || url.hostname !== 'thelist-dev.710labs.com' ||
		url.username || url.password || url.hash) throw new Error('BULK_DEV_ONLY')
	return url
}

function assertDevBaseUrl(value) {
	const url = assertDevUrl(value)
	if (url.pathname !== '/' || url.search) throw new Error('BULK_DEV_BASE_MUST_BE_ORIGIN')
	return url.origin
}

module.exports = { DEV_ORIGIN, assertDevUrl, assertDevBaseUrl }
