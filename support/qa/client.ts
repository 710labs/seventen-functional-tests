import { APIRequestContext, APIResponse } from '@playwright/test'

export const DEFAULT_QA_ENDPOINT_PATH = '/wp-json/seventen-qa/v1/'
export const LEGACY_QA_ENDPOINT_PATH = '/wp-content/plugins/seventen-qa/api/'

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

type QaEnvelope<T> = {
	outcome: string
	message: string
	data: T
}

type ProductLookup = {
	product_id?: number | string
	product_sku?: string
	product_name?: string
}

export function normalizeQaEndpointPath(qaEndpointPath?: string): string {
	const trimmedPath = qaEndpointPath?.trim()

	if (!trimmedPath || trimmedPath === LEGACY_QA_ENDPOINT_PATH) {
		return DEFAULT_QA_ENDPOINT_PATH
	}

	const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`

	return normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`
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

async function unwrapQaData<T>(
	response: APIResponse,
	action: string,
	expectedStatus: number,
): Promise<T> {
	const body = await readResponseBody(response)

	if (!response.ok()) {
		throw new Error(formatResponseError(action, response.status(), body))
	}

	if (response.status() !== expectedStatus) {
		throw new Error(
			`[qa] ${action} returned HTTP ${response.status()} instead of ${expectedStatus}`,
		)
	}

	if (!body || typeof body !== 'object' || !('data' in body)) {
		throw new Error(`[qa] ${action} returned an unexpected payload.`)
	}

	return (body as QaEnvelope<T>).data
}

export class QAClient {
	readonly request: APIRequestContext

	constructor(request: APIRequestContext) {
		this.request = request
	}

	async setDomainState(state: DomainState): Promise<string> {
		const data = await unwrapQaData<{ domain: string }>(
			await this.request.post('domains', {
				form: { state },
			}),
			`setDomainState(${state})`,
			200,
		)

		return data.domain
	}

	async createUser(user: QaUserRequest): Promise<QaUser> {
		const data = await unwrapQaData<{ user: QaUser }>(
			await this.request.post('users', {
				form: user,
			}),
			'createUser',
			201,
		)

		return data.user
	}

	async getRates({ post_code }: { post_code: string }): Promise<QaRates> {
		const data = await unwrapQaData<{ rates: QaRates }>(
			await this.request.get('rates', {
				params: { post_code },
			}),
			`getRates(${post_code})`,
			200,
		)

		return data.rates
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

		const data = await unwrapQaData<{ product: QaProduct }>(
			await this.request.get('products', {
				params,
			}),
			`getProduct(${description})`,
			200,
		)

		return data.product
	}
}
