const DEFAULT_QA_ENDPOINT_PATH = '/wp-json/seventen-qa/v1/'
const LEGACY_QA_ENDPOINT_PATH = '/wp-content/plugins/seventen-qa/api/'
const VALID_STATES = new Set(['ca', 'fl', 'mi', 'co', 'nj'])
const PRODUCTION_STATE_HOSTS = new Set([
	'thelist.710labs.com',
	'thelist-ca.710labs.com',
	'thelist-co.710labs.com',
	'thelist-fl.710labs.com',
	'thelist-mi.710labs.com',
	'thelist-nj.710labs.com',
])

const fetchFn =
	typeof globalThis.fetch === 'function'
		? globalThis.fetch.bind(globalThis)
		: async (...args) => {
				const { default: nodeFetch } = await import('node-fetch')
				return nodeFetch(...args)
			}

function normalizeQaEndpointPath(qaEndpointPath) {
	const trimmedPath = qaEndpointPath?.trim()

	if (!trimmedPath || trimmedPath === LEGACY_QA_ENDPOINT_PATH) {
		return DEFAULT_QA_ENDPOINT_PATH
	}

	const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`

	return normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`
}

function buildQaApiBaseUrl(baseURL, qaEndpointPath) {
	if (!baseURL) {
		throw new Error('BASE_URL is required to set the QA domain state.')
	}

	return new URL(normalizeQaEndpointPath(qaEndpointPath), baseURL).toString()
}

function assertSafeBaseUrl(baseURL) {
	if (!baseURL) {
		throw new Error('BASE_URL is required to set the QA domain state.')
	}

	let parsed
	try {
		parsed = new URL(baseURL)
	} catch {
		throw new Error(
			`BASE_URL "${baseURL}" is not a valid URL. Expected a fully-qualified URL including scheme, e.g. https://thelist-dev.710labs.com.`,
		)
	}

	const { hostname } = parsed

	if (
		PRODUCTION_STATE_HOSTS.has(hostname.toLowerCase()) &&
		process.env.ALLOW_PRODUCTION_QA_DOMAIN_SWITCH !== 'true'
	) {
		throw new Error(
			[
				`Refusing to switch QA domain state against production host "${hostname}".`,
				'Use BASE_URL for dev/stage, for example https://thelist-dev.710labs.com.',
				'Set ALLOW_PRODUCTION_QA_DOMAIN_SWITCH=true only for an intentional one-off override.',
			].join(' '),
		)
	}
}

async function readBody(response) {
	const text = await response.text()

	if (!text) {
		return null
	}

	try {
		return JSON.parse(text)
	} catch {
		return text
	}
}

async function main() {
	const state = (process.argv[2] || '').toLowerCase()
	const baseURL = process.env.BASE_URL
	const apiKey = process.env.API_KEY || process.env.SEVENTEN_QA_API_KEY
	assertSafeBaseUrl(baseURL)
	const qaApiBaseUrl = buildQaApiBaseUrl(baseURL, process.env.QA_ENDPOINT)

	if (!VALID_STATES.has(state)) {
		throw new Error(`Invalid state "${state}". Expected one of: ${Array.from(VALID_STATES).join(', ')}.`)
	}

	if (!apiKey) {
		throw new Error('API_KEY is required to set the QA domain state.')
	}

	const endpoint = new URL('domains', qaApiBaseUrl).toString()
	console.log(`[qa] Domain switch endpoint: ${endpoint}`)
	console.log(`[qa] Requested domain state: ${state}`)

	const response = await fetchFn(endpoint, {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({ state }).toString(),
	})
	const body = await readBody(response)

	if (!response.ok) {
		console.error(`[qa] Failed to set domain state to ${state}. HTTP ${response.status}`)
		console.error(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
		process.exit(1)
	}

	const domain = body?.data?.domain

	if (typeof domain !== 'string') {
		console.error('[qa] Domain set call succeeded but returned an unexpected payload.')
		console.error(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
		process.exit(1)
	}

	console.log(`[qa] Domain state set to ${state}. Returned state domain: ${domain}`)
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : error)
	process.exit(1)
})
