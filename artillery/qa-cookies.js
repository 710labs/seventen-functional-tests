const RECAPTCHA_BYPASS_COOKIE_NAME = 'qa_wf_captcha_bypass'
const VIP_CHECKER_COOKIE_NAME = 'vipChecker'

let warnedAboutMissingRecaptchaBypass = false

function getRecaptchaBypassSecret() {
	const secret = process.env.RECAPTCHA_BYPASS

	return secret && secret.trim() ? secret.trim() : undefined
}

function warnMissingRecaptchaBypass() {
	if (warnedAboutMissingRecaptchaBypass) {
		return
	}

	warnedAboutMissingRecaptchaBypass = true
	console.warn(
		`[qa-cookies] RECAPTCHA_BYPASS is not set; ${RECAPTCHA_BYPASS_COOKIE_NAME} will not be injected.`,
	)
}

function buildQaCookies(target) {
	const targetUrl = new URL(target)
	const cookies = [
		{
			name: VIP_CHECKER_COOKIE_NAME,
			value: '3',
			domain: targetUrl.hostname,
			path: '/',
		},
	]
	const recaptchaBypass = getRecaptchaBypassSecret()

	if (!recaptchaBypass) {
		warnMissingRecaptchaBypass()
		return cookies
	}

	cookies.push({
		name: RECAPTCHA_BYPASS_COOKIE_NAME,
		value: recaptchaBypass,
		domain: targetUrl.hostname,
		path: '/',
		httpOnly: false,
		secure: targetUrl.protocol === 'https:',
		sameSite: 'Lax',
	})

	return cookies
}

async function addQaCookies(page, target) {
	const cookies = buildQaCookies(target)
	const context = page.context()

	await context.addCookies(cookies)

	if (cookies.some(cookie => cookie.name === RECAPTCHA_BYPASS_COOKIE_NAME)) {
		const contextCookies = await context.cookies(target)
		const recaptchaCookieInjected = contextCookies.some(
			cookie => cookie.name === RECAPTCHA_BYPASS_COOKIE_NAME,
		)

		if (!recaptchaCookieInjected) {
			throw new Error(
				`Expected ${RECAPTCHA_BYPASS_COOKIE_NAME} to be present in the browser context before navigation.`,
			)
		}
	}
}

module.exports = {
	RECAPTCHA_BYPASS_COOKIE_NAME,
	VIP_CHECKER_COOKIE_NAME,
	addQaCookies,
	buildQaCookies,
	getRecaptchaBypassSecret,
}
