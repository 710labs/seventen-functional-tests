const REST_QA_ENDPOINT_PATH = '/wp-json/seventen-qa/v1/'
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

	if (!trimmedPath) {
		return LEGACY_QA_ENDPOINT_PATH
	}

	const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
	const pathWithTrailingSlash = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`

	return pathWithTrailingSlash === REST_QA_ENDPOINT_PATH
		? LEGACY_QA_ENDPOINT_PATH
		: pathWithTrailingSlash
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

function getErrorDetails(error) {
	if (!(error instanceof Error)) {
		return [String(error)]
	}

	const details = [error.message]
	const cause = error.cause

	if (cause) {
		details.push(cause instanceof Error ? `Cause: ${cause.message}` : `Cause: ${String(cause)}`)

		if (typeof cause === 'object') {
			for (const field of ['code', 'errno', 'syscall', 'hostname', 'host', 'port', 'address']) {
				const value = cause[field]
				if (value !== undefined) {
					details.push(`Cause ${field}: ${value}`)
				}
			}
		}
	}

	return details
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

	const endpointUrl = new URL('domains/update/', qaApiBaseUrl)
	endpointUrl.search = new URLSearchParams({ state }).toString()
	const endpoint = endpointUrl.toString()
	console.log(`[qa] Domain switch endpoint: ${endpoint}`)
	console.log(`[qa] Requested domain state: ${state}`)

	const response = await fetchFn(endpoint, {
		method: 'GET',
		headers: {
			'x-api-key': apiKey,
		},
	})
	const body = await readBody(response)

	if (!response.ok) {
		console.error(`[qa] Failed to set domain state to ${state}. HTTP ${response.status}`)
		console.error(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
		process.exit(1)
	}

	if (body) {
		console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
	}

	console.log(`[qa] Legacy domain switch request for ${state} succeeded.`)
}

main().catch(error => {
	for (const detail of getErrorDetails(error)) {
		console.error(detail)
	}
	process.exit(1)
})
