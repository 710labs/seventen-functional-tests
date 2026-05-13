import { APIRequestContext, APIResponse } from '@playwright/test'

export const REST_QA_ENDPOINT_PATH = '/wp-json/seventen-qa/v1/'
export const LEGACY_QA_ENDPOINT_PATH = '/wp-content/plugins/seventen-qa/api/'
export const DEFAULT_QA_ENDPOINT_PATH = LEGACY_QA_ENDPOINT_PATH

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

	const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
	const pathWithTrailingSlash = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`

	return pathWithTrailingSlash === REST_QA_ENDPOINT_PATH
		? DEFAULT_QA_ENDPOINT_PATH
		: pathWithTrailingSlash
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
		const parsedBody = body as { code?: string; message?: string }
		const detail = [parsedBody.code, parsedBody.message].filter(Boolean).join(': ')

		if (detail) {
			return `[qa] ${action} failed with HTTP ${status}: ${detail}`
		}
	}

	if (typeof body === 'string' && body.trim()) {
		return `[qa] ${action} failed with HTTP ${status}: ${body}`
	}

	return `[qa] ${action} failed with HTTP ${status}`
}

async function readSuccessfulBody(response: APIResponse, action: string): Promise<unknown> {
	const body = await readResponseBody(response)

	if (!response.ok()) {
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

	constructor(request: APIRequestContext) {
		this.request = request
	}

	async setDomainState(state: DomainState): Promise<string> {
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

	async createUser(user: QaUserRequest): Promise<QaUser> {
		const action = 'createUser'
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

	async getRates({ post_code }: { post_code: string }): Promise<QaRates> {
		const action = `getRates(${post_code})`
		const body = await readSuccessfulBody(
			await this.request.get('rates', {
				params: { postCode: post_code },
			}),
			action,
		)

		return normalizeRatesPayload(body, action)
	}

	async getProduct(selector: ProductLookup): Promise<QaProduct> {
		const params = Object.fromEntries(
			Object.entries(selector).filter(([, value]) => value !== undefined && value !== ''),
		)

		if (Object.keys(params).length === 0) {
			throw new Error('[qa] getProduct requires one of product_id, product_sku, or product_name.')
		}

		const description = Object.entries(params)
			.map(([key, value]) => `${key}=${value}`)
			.join(', ')

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

		const body = await readSuccessfulBody(
			await this.request.get('products/', {
				params: legacyParams,
			}),
			`getProduct(${description})`,
		)

		return normalizeProductPayload(body, `getProduct(${description})`)
	}
}
