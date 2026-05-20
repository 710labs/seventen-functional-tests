import { APIRequestContext, APIResponse } from '@playwright/test'

export const REST_QA_ENDPOINT_PATH = '/wp-json/seventen-qa/v1/'
export const LEGACY_QA_ENDPOINT_PATH = '/wp-content/plugins/seventen-qa/api/'
export const DEFAULT_QA_ENDPOINT_PATH = LEGACY_QA_ENDPOINT_PATH

export type QaEndpointMode = 'rest' | 'legacy'

export type DomainState = 'ca' | 'fl' | 'mi' | 'co' | 'nj'

export type QaUserRequest = {
	user_role: string
	user_vintage: string
	user_usage: string
}

export type QaUser = {
	email: string
	password: string
	role: string
	vintage: string
	usage: string
}

export type QaRate = {
	rate: number
	label: string
	shipping: string
	compound: string
}

export type QaRates = Record<string, QaRate[]>

export type QaProduct = {
	id: number
	name: string
	sku: string
	price: number | string
	tax_class: string
	found_by?: string
}

type ProductLookup = {
	product_id?: number | string
	product_sku?: string
	product_name?: string
}

export function normalizeQaEndpointPath(qaEndpointPath?: string): string {
	const trimmedPath = qaEndpointPath?.trim()

	if (!trimmedPath) {
		return DEFAULT_QA_ENDPOINT_PATH
	}

	let endpointPath = trimmedPath
	try {
		endpointPath = new URL(trimmedPath).pathname
	} catch {
		endpointPath = trimmedPath
	}

	const pathWithoutQuery = endpointPath.split(/[?#]/)[0]

	if (!pathWithoutQuery || pathWithoutQuery === '/' || pathWithoutQuery.startsWith('//')) {
		return DEFAULT_QA_ENDPOINT_PATH
	}

	const normalizedPath = pathWithoutQuery.startsWith('/')
		? pathWithoutQuery
		: `/${pathWithoutQuery}`
	const pathWithTrailingSlash = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`
	const normalizedLowerPath = pathWithTrailingSlash.toLowerCase()

	if (
		normalizedLowerPath === REST_QA_ENDPOINT_PATH ||
		normalizedLowerPath.startsWith(REST_QA_ENDPOINT_PATH)
	) {
		return REST_QA_ENDPOINT_PATH
	}

	if (
		normalizedLowerPath.includes('/wp-content/plugins/seventen-qa/src/api/') ||
		normalizedLowerPath.startsWith(LEGACY_QA_ENDPOINT_PATH) ||
		normalizedLowerPath.includes('/domains/update') ||
		normalizedLowerPath.includes('/users/create') ||
		normalizedLowerPath.includes('/users/delete')
	) {
		return LEGACY_QA_ENDPOINT_PATH
	}

	return pathWithTrailingSlash
}

export function getQaEndpointMode(qaEndpointPath?: string): QaEndpointMode {
	return normalizeQaEndpointPath(qaEndpointPath).toLowerCase() === REST_QA_ENDPOINT_PATH
		? 'rest'
		: 'legacy'
}

export function buildQaApiBaseUrl(baseURL?: string, qaEndpointPath?: string): string {
	if (!baseURL) {
		throw new Error('Playwright baseURL is required to initialize the QA API client.')
	}

	return new URL(normalizeQaEndpointPath(qaEndpointPath), baseURL).toString()
}

async function readResponseBody(response: APIResponse): Promise<unknown> {
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

function formatResponseError(action: string, status: number, body: unknown): string {
	if (body && typeof body === 'object') {
		const parsedBody = body as { code?: string; message?: string; outcome?: string }
		const detail = [parsedBody.code, parsedBody.outcome, parsedBody.message]
			.filter(Boolean)
			.join(': ')

		if (detail) {
			return `[qa] ${action} failed with HTTP ${status}: ${detail}`
		}
	}

	if (typeof body === 'string' && body.trim()) {
		return `[qa] ${action} failed with HTTP ${status}: ${body}`
	}

	return `[qa] ${action} failed with HTTP ${status}`
}

function getLegacyOutcome(body: unknown): string | null {
	const record =
		body && typeof body === 'object' && !Array.isArray(body)
			? (body as { outcome?: unknown })
			: null

	return typeof record?.outcome === 'string' ? record.outcome.toLowerCase() : null
}

function isLegacyFailureOutcome(outcome: string | null): boolean {
	return outcome === 'unauthorized' || outcome === 'failure' || outcome === 'inactive' || outcome === 'error'
}

async function readSuccessfulBody(response: APIResponse, action: string): Promise<unknown> {
	const body = await readResponseBody(response)

	if (!response.ok()) {
		throw new Error(formatResponseError(action, response.status(), body))
	}

	if (isLegacyFailureOutcome(getLegacyOutcome(body))) {
		throw new Error(formatResponseError(action, response.status(), body))
	}

	return body
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null
}

function formatUnexpectedPayload(action: string, body: unknown): Error {
	return new Error(
		`[qa] ${action} returned an unexpected payload: ${
			typeof body === 'string' ? body : JSON.stringify(body)
		}`,
	)
}

function normalizeUserPayload(body: unknown, action: string): QaUser {
	const record = asRecord(body)
	const data = asRecord(record?.data)
	const user = asRecord(data?.user) || asRecord(record?.user) || record

	if (user && typeof user.email === 'string' && typeof user.password === 'string') {
		return user as QaUser
	}

	throw formatUnexpectedPayload(action, body)
}

function normalizeRatesPayload(body: unknown, action: string): QaRates {
	const record = asRecord(body)
	const data = asRecord(record?.data)
	const rates = asRecord(data?.rates) || asRecord(record?.rates) || record

	if (rates) {
		return rates as QaRates
	}

	throw formatUnexpectedPayload(action, body)
}

function normalizeProductPayload(body: unknown, action: string): QaProduct {
	const record = asRecord(body)
	const data = asRecord(record?.data)
	const product = asRecord(data?.product) || asRecord(record?.product) || record

	if (product && (typeof product.id === 'number' || typeof product.id === 'string')) {
		return product as QaProduct
	}

	throw formatUnexpectedPayload(action, body)
}

export class QAClient {
	readonly request: APIRequestContext
	readonly endpointMode: QaEndpointMode

	constructor(
		request: APIRequestContext,
		endpointMode: QaEndpointMode = getQaEndpointMode(process.env.QA_ENDPOINT),
	) {
		this.request = request
		this.endpointMode = endpointMode
	}

	async setDomainState(state: DomainState): Promise<string> {
		if (this.endpointMode === 'legacy') {
			const body = await readSuccessfulBody(
				await this.request.get('domains/update/', {
					params: { state },
				}),
				`setDomainState(${state})`,
			)
			const record = asRecord(body)
			const data = asRecord(record?.data)
			const domain = data?.domain || record?.domain

			return typeof domain === 'string' ? domain : state
		}

		const body = await readSuccessfulBody(
			await this.request.post('domains', {
				form: { state },
			}),
			`setDomainState(${state})`,
		)
		const record = asRecord(body)
		const data = asRecord(record?.data)
		const domain = data?.domain || record?.domain

		if (typeof domain === 'string') {
			return domain
		}

		throw formatUnexpectedPayload(`setDomainState(${state})`, body)
	}

	async createUser(user: QaUserRequest): Promise<QaUser> {
		const action = 'createUser'

		if (this.endpointMode === 'legacy') {
			const body = await readSuccessfulBody(
				await this.request.get('users/create/', {
					params: {
						userRole: user.user_role,
						userUsage: user.user_usage,
						userVintage: user.user_vintage,
					},
				}),
				action,
			)

			return normalizeUserPayload(body, action)
		}

		const body = await readSuccessfulBody(
			await this.request.post('users', {
				form: {
					user_role: user.user_role,
					user_usage: user.user_usage,
					user_vintage: user.user_vintage,
				},
			}),
			action,
		)

		return normalizeUserPayload(body, action)
	}

	async getRates({ post_code }: { post_code: string }): Promise<QaRates> {
		const action = `getRates(${post_code})`

		if (this.endpointMode === 'legacy') {
			const body = await readSuccessfulBody(
				await this.request.get('rates', {
					params: { postCode: post_code },
				}),
				action,
			)

			return normalizeRatesPayload(body, action)
		}

		const body = await readSuccessfulBody(
			await this.request.get('rates', {
				params: { post_code },
			}),
			action,
		)

		return normalizeRatesPayload(body, action)
	}

	async getProduct(selector: ProductLookup): Promise<QaProduct> {
		const params = Object.fromEntries(
			Object.entries(selector).filter(([, value]) => value !== undefined && value !== ''),
		) as ProductLookup

		if (Object.keys(params).length === 0) {
			throw new Error('[qa] getProduct requires one of product_id, product_sku, or product_name.')
		}

		const description = Object.entries(params)
			.map(([key, value]) => `${key}=${value}`)
			.join(', ')
		let requestParams = params as Record<string, string | number>

		if (this.endpointMode === 'legacy') {
			const legacyParams: Record<string, string | number> = {}
			if (params.product_id !== undefined) {
				legacyParams.productId = params.product_id
			}
			if (params.product_sku !== undefined) {
				legacyParams.productSku = params.product_sku
			}
			if (params.product_name !== undefined) {
				legacyParams.productName = params.product_name
			}
			requestParams = legacyParams
		}

		const body = await readSuccessfulBody(
			await this.request.get('products/', {
				params: requestParams,
			}),
			`getProduct(${description})`,
		)

		return normalizeProductPayload(body, `getProduct(${description})`)
	}
}
