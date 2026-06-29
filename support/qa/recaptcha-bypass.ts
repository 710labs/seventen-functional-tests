import type { BrowserContext, Cookie } from '@playwright/test'

export const RECAPTCHA_BYPASS_COOKIE_NAME = 'qa_wf_captcha_bypass'
export const VIP_BYPASS_COOKIE_NAME = 'vipChecker'

function getRecaptchaBypassSecret() {
	const secret = process.env.RECAPTCHA_BYPASS

	return secret && secret.trim() ? secret : undefined
}

function parseBaseUrl(baseURL?: string) {
	if (!baseURL?.trim()) {
		return undefined
	}

	try {
		return new URL(baseURL)
	} catch {
		return undefined
	}
}

export function buildRecaptchaBypassCookie(baseURL?: string): Cookie | undefined {
	const secret = getRecaptchaBypassSecret()
	const url = parseBaseUrl(baseURL)

	if (!secret || !url) {
		return undefined
	}

	return {
		name: RECAPTCHA_BYPASS_COOKIE_NAME,
		value: secret,
		domain: url.hostname,
		path: '/',
		expires: -1,
		httpOnly: false,
		secure: url.protocol === 'https:',
		sameSite: 'Lax',
	}
}

export function buildRecaptchaBypassCookies(baseURL?: string): Cookie[] {
	const cookie = buildRecaptchaBypassCookie(baseURL)

	return cookie ? [cookie] : []
}

export function buildVipBypassCookie(baseURL?: string): Cookie | undefined {
	const url = parseBaseUrl(baseURL)

	if (!url) {
		return undefined
	}

	return {
		name: VIP_BYPASS_COOKIE_NAME,
		value: '3',
		domain: url.hostname,
		path: '/',
		expires: -1,
		httpOnly: false,
		secure: url.protocol === 'https:',
		sameSite: 'Lax',
	}
}

export function buildListBypassCookies(baseURL?: string): Cookie[] {
	const vipBypassCookie = buildVipBypassCookie(baseURL)

	return [
		...(vipBypassCookie ? [vipBypassCookie] : []),
		...buildRecaptchaBypassCookies(baseURL),
	]
}

export function buildStorageStateWithRecaptchaBypass(baseURL?: string, cookies: Cookie[] = []) {
	return {
		cookies: [...cookies, ...buildRecaptchaBypassCookies(baseURL)],
		origins: [],
	}
}

export function buildStorageStateWithListBypass(baseURL?: string, cookies: Cookie[] = []) {
	return {
		cookies: [...cookies, ...buildListBypassCookies(baseURL)],
		origins: [],
	}
}

export async function addRecaptchaBypassCookie(context: BrowserContext, baseURL?: string) {
	const cookies = buildRecaptchaBypassCookies(baseURL)

	if (cookies.length) {
		await context.addCookies(cookies)
	}
}

export async function addListBypassCookies(context: BrowserContext, baseURL?: string) {
	const cookies = buildListBypassCookies(baseURL)

	if (cookies.length) {
		await context.addCookies(cookies)
	}
}
