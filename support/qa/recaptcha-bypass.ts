import type { BrowserContext, Cookie } from '@playwright/test'

export const RECAPTCHA_BYPASS_COOKIE_NAME = 'qa_wf_captcha_bypass'

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

export function buildStorageStateWithRecaptchaBypass(baseURL?: string, cookies: Cookie[] = []) {
	return {
		cookies: [...cookies, ...buildRecaptchaBypassCookies(baseURL)],
		origins: [],
	}
}

export async function addRecaptchaBypassCookie(context: BrowserContext, baseURL?: string) {
	const cookies = buildRecaptchaBypassCookies(baseURL)

	if (cookies.length) {
		await context.addCookies(cookies)
	}
}
