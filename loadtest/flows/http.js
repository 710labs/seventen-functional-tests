'use strict'

const cheerio = require('cheerio')

const DEFAULT_TARGET = 'https://thelist-dev.710labs.com'
const DEFAULT_USER_AGENT =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const ENTRY_EXPECTED_STATUS = 302
const QUEUE_IT_HOST_RE = /queue-it\.net/i
const RECAPTCHA_BYPASS_COOKIE_NAME = 'qa_wf_captcha_bypass'
const VIP_CHECKER_COOKIE_NAME = 'vipChecker'
const BODY_PREVIEW_LENGTH = 800

const FIRST_NAMES = [
	'LoadTest_James',
	'LoadTest_John',
	'LoadTest_Robert',
	'LoadTest_Michael',
	'LoadTest_William',
	'LoadTest_David',
	'LoadTest_Richard',
	'LoadTest_Joseph',
]

const LAST_NAMES = [
	'LoadTest_Smith',
	'LoadTest_Johnson',
	'LoadTest_Williams',
	'LoadTest_Brown',
	'LoadTest_Jones',
	'LoadTest_Garcia',
	'LoadTest_Miller',
	'LoadTest_Davis',
]

function callback(done, error) {
	if (typeof done === 'function') {
		return done(error || null)
	}

	if (error) {
		throw error
	}
}

function isUsableValue(value) {
	if (typeof value !== 'string') {
		return value !== undefined && value !== null
	}

	const trimmed = value.trim()

	return trimmed !== '' && trimmed !== 'undefined' && trimmed !== 'null'
}

function firstUsable(...values) {
	return values.find(isUsableValue)
}

function normalizeTarget(target) {
	const rawTarget = String(firstUsable(target, DEFAULT_TARGET)).trim()
	const targetWithProtocol = /^https?:\/\//i.test(rawTarget) ? rawTarget : `https://${rawTarget}`
	const url = new URL(targetWithProtocol)

	url.hash = ''

	return url.toString().replace(/\/$/, '')
}

function resolveTarget(context) {
	const vars = context.vars || {}

	return normalizeTarget(
		firstUsable(
			vars.target,
			vars.artilleryTarget,
			process.env.ARTILLERY_TARGET,
			vars.defaultTarget,
			DEFAULT_TARGET,
		),
	)
}

function resolveUrl(context, value) {
	const target = context.vars.normalizedTarget || resolveTarget(context)
	const defaultTarget = normalizeTarget(context.vars.defaultTarget || DEFAULT_TARGET)

	if (!value || value === '/') {
		return `${target}/`
	}

	if (/^https?:\/\//i.test(value)) {
		const url = new URL(value)
		const defaultUrl = new URL(defaultTarget)

		if (url.origin === defaultUrl.origin) {
			return new URL(`${url.pathname}${url.search}${url.hash}`, `${target}/`).toString()
		}

		return url.toString()
	}

	return new URL(value, `${target}/`).toString()
}

function lowerHeaderName(name) {
	return String(name).toLowerCase()
}

function setHeader(headers, name, value) {
	if (!isUsableValue(value)) {
		return
	}

	headers[lowerHeaderName(name)] = String(value)
}

function addCommonHeaders(requestParams, context) {
	requestParams.headers = requestParams.headers || {}

	setHeader(requestParams.headers, 'accept', requestParams.headers.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
	setHeader(requestParams.headers, 'accept-language', requestParams.headers['accept-language'] || 'en-US,en;q=0.9')
	setHeader(requestParams.headers, 'user-agent', requestParams.headers['user-agent'] || DEFAULT_USER_AGENT)
	setHeader(requestParams.headers, 'x-seventen-loadtest', 'drop-simulation-http')

	if (context.vars.lastUrl) {
		setHeader(requestParams.headers, 'referer', context.vars.lastUrl)
	}
}

function addCookies(requestParams, cookies) {
	requestParams.cookie = Object.assign({}, requestParams.cookie || {}, cookies)
	requestParams.headers = requestParams.headers || {}

	const cookieHeader = Object.entries(requestParams.cookie)
		.filter(([, value]) => isUsableValue(value))
		.map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`)
		.join('; ')

	setHeader(requestParams.headers, 'cookie', cookieHeader)
}

function buildQaCookies(context) {
	const cookies = {
		[VIP_CHECKER_COOKIE_NAME]: firstUsable(
			process.env.VIP_COOKIE_VALUE,
			process.env.ARTILLERY_VIP_COOKIE_VALUE,
			context.vars.vipCookieValue,
			'3',
		),
	}
	const recaptchaBypass = firstUsable(
		context.vars.recaptchaBypass,
		process.env.RECAPTCHA_BYPASS,
		process.env.ARTILLERY_RECAPTCHA_BYPASS,
	)

	if (recaptchaBypass) {
		cookies[RECAPTCHA_BYPASS_COOKIE_NAME] = String(recaptchaBypass).trim()
	}

	return cookies
}

function prepareAgeGateApiRequest(requestParams, context, events, done) {
	try {
		addFunnelCookiesAndHeaders(requestParams, context, events)
		requestParams.method = 'GET'
		requestParams.url = resolveUrl(
			context,
			'/wp-json/age-gate/v3/check?age_gate[lang]=en&age_gate[confirm]=1',
		)
		delete requestParams.form
		delete requestParams.qs

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function preparePasswordPostRequest(requestParams, context, events, done) {
	try {
		addFunnelCookiesAndHeaders(requestParams, context, events)
		requestParams.url = resolveUrl(context, '/')
		setRequestBody(requestParams, 'POST', {
			wcps_login: '1',
			post_password: requireListPassword(context),
			Submit: 'Enter Site',
		})

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function prepareRegisterGetRequest(requestParams, context, events, done) {
	try {
		addFunnelCookiesAndHeaders(requestParams, context, events)
		requestParams.method = 'GET'
		requestParams.url = resolveUrl(context, '/register/')
		delete requestParams.form
		delete requestParams.qs

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function buildAgeGateCookies() {
	return {
		age_gate: '1',
		age_gate_confirmed: '1',
		age_verified: '1',
		svntn_age_gate: '1',
	}
}

function prepareAbsoluteRequest(requestParams, context) {
	context.vars.normalizedTarget = resolveTarget(context)
	requestParams.url = resolveUrl(context, requestParams.url || requestParams.uri || '/')
	delete requestParams.uri
}

function prepareEntryRequest(requestParams, context, events, done) {
	try {
		prepareAbsoluteRequest(requestParams, context)
		addCommonHeaders(requestParams, context)
		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function addFunnelCookiesAndHeaders(requestParams, context, events, done) {
	try {
		prepareAbsoluteRequest(requestParams, context)
		addCommonHeaders(requestParams, context)
		addCookies(requestParams, buildQaCookies(context))
		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function getHeader(response, name) {
	const headers = response.headers || {}
	const value = headers[lowerHeaderName(name)] || headers[name]

	if (Array.isArray(value)) {
		return value.join(', ')
	}

	return value || ''
}

function getResponseUrl(requestParams, response) {
	return response.url || response.requestUrl || requestParams.url
}

function bodyText(response) {
	if (typeof response.body === 'string') {
		return response.body
	}

	if (Buffer.isBuffer(response.body)) {
		return response.body.toString('utf8')
	}

	return ''
}

function bodyPreview(response) {
	return bodyText(response).replace(/\s+/g, ' ').trim().slice(0, BODY_PREVIEW_LENGTH)
}

function assertNotQueueIt(requestParams, response) {
	const location = getHeader(response, 'location')
	const responseUrl = getResponseUrl(requestParams, response)

	if (QUEUE_IT_HOST_RE.test(location) || QUEUE_IT_HOST_RE.test(responseUrl)) {
		throw new Error(`Unexpected Queue-it response in funnel. status=${response.statusCode} location=${location || 'none'} url=${responseUrl}`)
	}
}

function assertQueueItRedirect(requestParams, response, context, events, done) {
	try {
		const location = getHeader(response, 'location')

		if (response.statusCode !== ENTRY_EXPECTED_STATUS) {
			throw new Error(
				`Expected HTTP ${ENTRY_EXPECTED_STATUS} from queue entry, got ${response.statusCode}. Body: ${bodyPreview(response)}`,
			)
		}

		if (!QUEUE_IT_HOST_RE.test(location)) {
			throw new Error(`Expected Queue-it redirect Location, got "${location || 'missing'}".`)
		}

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function pick(values) {
	return values[Math.floor(Math.random() * values.length)]
}

function randomNumber() {
	return Math.floor(Math.random() * 900000) + 100000
}

function randomPhone() {
	const middle = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
	const last = String(Math.floor(Math.random() * 10000)).padStart(4, '0')

	return `555-${middle}-${last}`
}

function normalizeUsageType(value) {
	const normalized = String(firstUsable(value, 'Recreational')).trim().toLowerCase()

	return normalized === 'medical' ? 'Medical' : 'Recreational'
}

function seedFunnelUser(context, events, done) {
	try {
		context.vars.normalizedTarget = resolveTarget(context)
		context.vars.listPassword = firstUsable(
			context.vars.listPassword,
			process.env.ARTILLERY_LIST_PASSWORD,
			process.env.LIST_PASSWORD,
		)

		const firstName = pick(FIRST_NAMES)
		const lastName = pick(LAST_NAMES)
		const suffix = `${Date.now()}-${randomNumber()}`
		const usageType = normalizeUsageType(process.env.ARTILLERY_USAGE_TYPE)

		context.vars.user = {
			firstName,
			lastName,
			email: `loadtest-${firstName.toLowerCase()}.${lastName.toLowerCase()}.${suffix}@loadtest.com`,
			password: `LoadTest-${suffix}`,
			phone: randomPhone(),
			address: process.env.ARTILLERY_BILLING_ADDRESS || '3377 S La Cienega Blvd',
			city: process.env.ARTILLERY_BILLING_CITY || 'Los Angeles',
			state: process.env.ARTILLERY_BILLING_STATE || 'CA',
			zip: process.env.ARTILLERY_BILLING_ZIP || '90016',
			usageType,
			usageValue: usageType.toLowerCase(),
			birthMonth: '12',
			birthDay: '16',
			birthYear: '1988',
			documentExpMonth: '12',
			documentExpDay: '16',
			documentExpYear: String(new Date().getFullYear() + 1),
		}

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function loadHtml(response) {
	return cheerio.load(bodyText(response), { decodeEntities: false })
}

function formText($, form) {
	return `${form.attr('id') || ''} ${form.attr('class') || ''} ${form.text() || ''}`.replace(/\s+/g, ' ')
}

function formHasInput(form, name) {
	return form.find(`[name="${name}"]`).length > 0
}

function findForm($, predicate) {
	let match = null

	$('form').each((index, element) => {
		if (match) {
			return
		}

		const form = $(element)

		if (predicate(form)) {
			match = form
		}
	})

	return match
}

function findAgeGateForm($) {
	return findForm($, form => {
		if (formHasInput(form, 'post_password')) {
			return false
		}

		return /age|qualif|over\s+21|21|18/i.test(formText($, form))
	})
}

function findPasswordForm($) {
	return findForm($, form => formHasInput(form, 'post_password'))
}

function findRegistrationForm($) {
	return findForm($, form => {
		return (
			formHasInput(form, 'email') &&
			(formHasInput(form, 'password') ||
				formHasInput(form, 'svntn_core_registration_firstname') ||
				formHasInput(form, 'billing_address_1'))
		)
	})
}

function resolveFormAction(form, requestParams, response, context) {
	const base = getResponseUrl(requestParams, response) || resolveUrl(context, '/')
	const action = form.attr('action') || base

	return new URL(action, base).toString()
}

function resolveFormMethod(form, fallback) {
	return String(form.attr('method') || fallback || 'POST').trim().toUpperCase()
}

function setField(fields, name, value) {
	if (!name || value === undefined || value === null) {
		return
	}

	fields[name] = String(value)
}

function collectFormFields($, form) {
	const fields = {}

	form.find('input').each((index, element) => {
		const input = $(element)
		const name = input.attr('name')
		const type = String(input.attr('type') || 'text').toLowerCase()

		if (!name || ['button', 'file', 'image', 'reset'].includes(type)) {
			return
		}

		if (type === 'submit') {
			if (!fields.__submitName) {
				fields.__submitName = name
				fields.__submitValue = input.attr('value') || 'Submit'
			}
			return
		}

		if ((type === 'checkbox' || type === 'radio') && input.attr('checked') === undefined) {
			return
		}

		setField(fields, name, input.attr('value') || '')
	})

	form.find('select').each((index, element) => {
		const select = $(element)
		const name = select.attr('name')
		const selected = select.find('option[selected]').first()
		const option = selected.length ? selected : select.find('option').first()

		setField(fields, name, option.attr('value') || option.text() || '')
	})

	form.find('textarea').each((index, element) => {
		const textarea = $(element)

		setField(fields, textarea.attr('name'), textarea.text() || '')
	})

	if (fields.__submitName) {
		setField(fields, fields.__submitName, fields.__submitValue)
		delete fields.__submitName
		delete fields.__submitValue
	}

	return fields
}

function captureForm(context, key, $, form, requestParams, response, methodFallback) {
	if (!form) {
		return
	}

	context.vars[`${key}Action`] = resolveFormAction(form, requestParams, response, context)
	context.vars[`${key}Method`] = resolveFormMethod(form, methodFallback)
	context.vars[`${key}Fields`] = collectFormFields($, form)
}

function captureCreateAccountLink(context, $, requestParams, response) {
	let href = ''

	$('a').each((index, element) => {
		if (href) {
			return
		}

		const link = $(element)
		const text = link.text().replace(/\s+/g, ' ').trim()

		if (/create\s+an\s+account|register/i.test(text)) {
			href = link.attr('href') || ''
		}
	})

	if (href) {
		context.vars.registerUrl = new URL(href, getResponseUrl(requestParams, response)).toString()
	}
}

function captureFunnelState(requestParams, response, context, events, done) {
	try {
		assertNotQueueIt(requestParams, response)

		if (response.statusCode >= 400) {
			throw new Error(`Unexpected HTTP ${response.statusCode} in funnel. Body: ${bodyPreview(response)}`)
		}

		context.vars.lastUrl = getResponseUrl(requestParams, response)

		const $ = loadHtml(response)

		captureForm(context, 'ageGate', $, findAgeGateForm($), requestParams, response, 'POST')
		captureForm(context, 'password', $, findPasswordForm($), requestParams, response, 'POST')
		captureForm(context, 'registration', $, findRegistrationForm($), requestParams, response, 'POST')
		captureCreateAccountLink(context, $, requestParams, response)

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function setRequestBody(requestParams, method, fields) {
	requestParams.method = method

	if (method === 'GET') {
		const query = new URLSearchParams(fields).toString()

		if (query) {
			const separator = requestParams.url.includes('?') ? '&' : '?'
			requestParams.url = `${requestParams.url}${separator}${query}`
		}

		delete requestParams.form
		delete requestParams.qs
		return
	}

	requestParams.form = fields
	delete requestParams.qs
}

function prepareAgeGateRequest(requestParams, context, events, done) {
	try {
		addFunnelCookiesAndHeaders(requestParams, context, events)
		addCookies(requestParams, buildAgeGateCookies())

		if (!context.vars.ageGateAction) {
			requestParams.method = 'GET'
			requestParams.url = resolveUrl(context, '/')
			delete requestParams.form
			return callback(done)
		}

		requestParams.url = context.vars.ageGateAction
		setRequestBody(
			requestParams,
			context.vars.ageGateMethod || 'POST',
			Object.assign({}, context.vars.ageGateFields || {}),
		)

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function requireListPassword(context) {
	const password = firstUsable(
		context.vars.listPassword,
		process.env.ARTILLERY_LIST_PASSWORD,
		process.env.LIST_PASSWORD,
	)

	if (!password) {
		throw new Error('ARTILLERY_LIST_PASSWORD is required for the HTTP funnel password step.')
	}

	return String(password)
}

function prepareListPasswordRequest(requestParams, context, events, done) {
	try {
		addFunnelCookiesAndHeaders(requestParams, context, events)

		const fields = Object.assign({}, context.vars.passwordFields || {})
		fields.post_password = requireListPassword(context)
		requestParams.url =
			context.vars.passwordAction || new URL('/wp-login.php?action=postpass', `${context.vars.normalizedTarget}/`).toString()

		setRequestBody(requestParams, context.vars.passwordMethod || 'POST', fields)

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function prepareRegisterPageRequest(requestParams, context, events, done) {
	try {
		addFunnelCookiesAndHeaders(requestParams, context, events)
		requestParams.method = 'GET'
		requestParams.url = context.vars.registerUrl || resolveUrl(context, '/my-account/')
		delete requestParams.form
		delete requestParams.qs

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function buildRegistrationFields(context) {
	const user = context.vars.user

	if (!user) {
		throw new Error('Funnel user was not initialized before registration.')
	}

	return {
		svntn_core_registration_firstname: user.firstName,
		svntn_core_registration_lastname: user.lastName,
		email: user.email,
		password: user.password,
		svntn_core_dob_month: user.birthMonth,
		svntn_core_dob_day: user.birthDay,
		svntn_core_dob_year: user.birthYear,
		billing_address_1: user.address,
		billing_city: user.city,
		billing_state: user.state,
		billing_postcode: user.zip,
		svntn_core_registration_zip: user.zip,
		billing_phone: user.phone,
		svntn_last_usage_type: user.usageValue,
		svntn_core_pxp_month: user.documentExpMonth,
		svntn_core_pxp_day: user.documentExpDay,
		svntn_core_pxp_year: user.documentExpYear,
		terms: 'on',
		privacy_policy: 'on',
		woocommerce_process_registration: '1',
		register: 'Register',
	}
}

function prepareRegistrationRequest(requestParams, context, events, done) {
	try {
		addFunnelCookiesAndHeaders(requestParams, context, events)

		const capturedFields = context.vars.registrationFields || {}
		const fields = Object.assign({}, capturedFields, buildRegistrationFields(context))
		requestParams.url = context.vars.registrationAction || context.vars.registerUrl || resolveUrl(context, '/my-account/')
		setRequestBody(requestParams, context.vars.registrationMethod || 'POST', fields)

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

function extractErrorText(response) {
	const $ = loadHtml(response)
	const texts = []

	$('.woocommerce-error, .age-gate__error, .eligibilityError, p.eligibilityError, .wc-block-components-notice-banner')
		.each((index, element) => {
			const text = $(element).text().replace(/\s+/g, ' ').trim()

			if (text) {
				texts.push(text)
			}
		})

	return texts.join(' | ')
}

function assertFunnelResponse(requestParams, response, context, events, done) {
	try {
		assertNotQueueIt(requestParams, response)

		if (response.statusCode >= 400) {
			throw new Error(`Unexpected HTTP ${response.statusCode} in HTTP funnel. Body: ${bodyPreview(response)}`)
		}

		const errorText = extractErrorText(response)

		if (/captcha|recaptcha|wordfence/i.test(errorText)) {
			throw new Error(`Registration was blocked by captcha/Wordfence: ${errorText}`)
		}

		context.vars.lastUrl = getResponseUrl(requestParams, response)

		return callback(done)
	} catch (error) {
		return callback(done, error)
	}
}

module.exports = {
	addFunnelCookiesAndHeaders,
	assertFunnelResponse,
	assertQueueItRedirect,
	captureFunnelState,
	prepareAgeGateApiRequest,
	prepareAgeGateRequest,
	prepareEntryRequest,
	prepareListPasswordRequest,
	preparePasswordPostRequest,
	prepareRegisterGetRequest,
	prepareRegisterPageRequest,
	prepareRegistrationRequest,
	seedFunnelUser,
}
