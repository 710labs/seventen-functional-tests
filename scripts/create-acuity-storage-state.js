#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { chromium } = require('@playwright/test')

const schedulingFrameSelector = '[data-test="scheduling"], [data-test="scheduling-iframe"]'
const offerClassButtonSelector = '#offer-class-btn, [data-testid="offer-class"]'
const defaultVerificationUrl =
	'https://secure.acuityscheduling.com/appointments.php?action=editAppointmentType&id=74252273'
const defaultLoginMaxAttempts = 5
const defaultLoginRetryTimeoutMs = defaultLoginMaxAttempts * 30 * 1000
const loginAttemptSettleTimeoutMs = 15 * 1000
const pageLoadSettleTimeoutMs = 10 * 1000
const loginTypingDelayMs = 75
const acuityNavigationTimeoutMs = 30 * 1000
const outputPath = process.env.ACUITY_STORAGE_STATE_FILE || '.auth/acuity-storage-state.json'

function fail(message) {
	console.error(message)
	process.exit(1)
}

function loginRetryTimeoutMs() {
	const configuredTimeout = Number.parseInt(process.env.ACUITY_LOGIN_RETRY_TIMEOUT_MS || '', 10)
	return Number.isFinite(configuredTimeout) && configuredTimeout > 0
		? configuredTimeout
		: defaultLoginRetryTimeoutMs
}

function loginMaxAttempts() {
	const configuredAttempts = Number.parseInt(process.env.ACUITY_LOGIN_MAX_ATTEMPTS || '', 10)
	return Number.isFinite(configuredAttempts) && configuredAttempts > 0
		? configuredAttempts
		: defaultLoginMaxAttempts
}

function remainingMs(deadline) {
	return Math.max(deadline - Date.now(), 0)
}

function diagnostic(message) {
	return String(message).replace(/\s+/g, ' ').trim().slice(0, 300)
}

function isSquarespaceLoginUrl(url) {
	const normalizedUrl = url.toLowerCase()
	return (
		normalizedUrl.includes('login.squarespace.com') ||
		(normalizedUrl.includes('squarespace.com') && normalizedUrl.includes('/login'))
	)
}

function isAuthChallengeUrl(url) {
	const normalizedUrl = url.toLowerCase()
	return [
		'captcha',
		'challenge',
		'mfa',
		'security-check',
		'two-factor',
		'verification',
	].some(fragment => normalizedUrl.includes(fragment))
}

function isAuthChallengeMessage(message) {
	const normalizedMessage = message.toLowerCase()
	return ['captcha', 'mfa', 'security-check', 'two-factor', 'verification'].some(fragment =>
		normalizedMessage.includes(fragment),
	)
}

function directAcuityEditorUrl(slotUrl) {
	try {
		const url = new URL(slotUrl)
		const appointmentId = url.searchParams.get('id')
		if (!appointmentId) {
			return slotUrl
		}

		const directUrl = new URL('https://secure.acuityscheduling.com/appointments.php')
		directUrl.searchParams.set('action', url.searchParams.get('action') || 'editAppointmentType')
		directUrl.searchParams.set('id', appointmentId)
		return directUrl.toString()
	} catch {
		return slotUrl
	}
}

function normalizeRowLevelQuotes(value) {
	return value
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.split('\n')
		.map((line, index) => {
			if (index === 0 || line.trim() === '') {
				return line
			}

			const trimmed = line.trim()
			if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.includes(';')) {
				return trimmed.slice(1, -1).replace(/""/g, '"')
			}

			return line
		})
		.join('\n')
}

function verificationUrlFromCsv() {
	const csvPath = process.env.ACUITY_SLOT_FILE
	if (!csvPath || !fs.existsSync(csvPath)) {
		return null
	}

	const content = normalizeRowLevelQuotes(fs.readFileSync(csvPath, 'utf8'))
	const lines = content.split('\n').filter(line => line.trim())
	if (lines.length < 2) {
		return null
	}

	const headers = lines[0].replace(/^\uFEFF/, '').split(';').map(header => header.trim())
	const urlIndex = headers.indexOf('URL')
	if (urlIndex < 0) {
		return null
	}

	for (const line of lines.slice(1)) {
		const fields = line.split(';')
		const url = String(fields[urlIndex] || '').trim()
		if (url) {
			return url
		}
	}

	return null
}

function verificationUrl() {
	return directAcuityEditorUrl(
		process.env.ACUITY_AUTH_VERIFY_URL || verificationUrlFromCsv() || defaultVerificationUrl,
	)
}

async function schedulingLocator(page, selector) {
	if ((await page.locator(schedulingFrameSelector).count()) > 0) {
		return page.frameLocator(schedulingFrameSelector).locator(selector)
	}

	return page.locator(selector)
}

async function pageContextMessage(page) {
	const title = await page.title().catch(() => 'unavailable')
	return `Current URL: ${page.url()}. Page title: ${title}.`
}

async function failWithPageContext(page, message, cause) {
	const contextMessage = await pageContextMessage(page)
	const causeMessage = cause instanceof Error ? ` ${cause.message}` : ''
	throw new Error(`${message} ${contextMessage}${causeMessage}`)
}

async function dismissAcuityInterruptions(page) {
	await page.keyboard.press('Escape').catch(() => undefined)

	for (const selector of [
		'button[aria-label="Close"]',
		'[aria-label="Close"]',
		'button:has-text("No thanks")',
		'button:has-text("Maybe later")',
		'button:has-text("Not now")',
		'button:has-text("Dismiss")',
		'button:has-text("Close")',
	]) {
		const target = page.locator(selector).last()
		if (await target.isVisible({ timeout: 1500 }).catch(() => false)) {
			await target.click({ timeout: 1500 }).catch(() => undefined)
		}
	}
}

async function gotoAcuityPage(page, url, context) {
	await page.goto(url, {
		waitUntil: 'domcontentloaded',
		timeout: acuityNavigationTimeoutMs,
	})
	await page.waitForLoadState('networkidle', { timeout: pageLoadSettleTimeoutMs }).catch(() => undefined)
	await dismissAcuityInterruptions(page)

	if (isAuthChallengeUrl(page.url())) {
		await failWithPageContext(
			page,
			`${context}: Squarespace returned an authentication challenge that cannot be completed in CI.`,
		)
	}
}

async function loginPageMessage(page) {
	if (!isSquarespaceLoginUrl(page.url())) {
		return null
	}

	const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '')
	const normalizedText = bodyText.replace(/\s+/g, ' ').trim()
	if (!normalizedText) {
		return null
	}

	const hasLoginProblem = [
		'captcha',
		'incorrect',
		'invalid',
		'try again',
		'two-factor',
		'unable to log in',
		'verification',
	].some(fragment => normalizedText.toLowerCase().includes(fragment))

	return hasLoginProblem ? normalizedText.slice(0, 300) : null
}

async function submitAcuityLogin(page, acuityUser, acuityPassword, timeoutMs) {
	const emailInput = page
		.locator('[placeholder="name\\@example\\.com"], input[type="email"], input[name="email"]')
		.first()
	const passwordInput = page.locator('[placeholder="Password"], input[type="password"]').first()
	const loginButton = page
		.locator('[data-test="login-button"], button:has-text("Log In"), button:has-text("Log in")')
		.first()
	const normalizedAcuityUser = acuityUser.trim()

	await emailInput.waitFor({ state: 'visible', timeout: timeoutMs })
	await emailInput.fill('', { timeout: timeoutMs })
	await emailInput.pressSequentially(normalizedAcuityUser, {
		delay: loginTypingDelayMs,
		timeout: timeoutMs,
	})
	await passwordInput.fill('', { timeout: timeoutMs })
	await passwordInput.pressSequentially(acuityPassword, {
		delay: loginTypingDelayMs,
		timeout: timeoutMs,
	})
	await page.waitForTimeout(300)

	const enteredEmail = await emailInput.inputValue({ timeout: timeoutMs })
	if (enteredEmail !== normalizedAcuityUser) {
		throw new Error(
			`Acuity username field did not match the configured username after typing. Expected length ${normalizedAcuityUser.length}, actual length ${enteredEmail.length}.`,
		)
	}

	const enteredPassword = await passwordInput.inputValue({ timeout: timeoutMs })
	if (enteredPassword !== acuityPassword) {
		throw new Error(
			`Acuity password field did not match the configured password after typing. Expected length ${acuityPassword.length}, actual length ${enteredPassword.length}.`,
		)
	}

	await loginButton.click({ timeout: timeoutMs })
}

async function waitForLoginAttempt(page, timeoutMs) {
	await page
		.waitForURL(url => !isSquarespaceLoginUrl(url.toString()), {
			timeout: timeoutMs,
		})
		.catch(() => undefined)

	await page
		.waitForLoadState('networkidle', {
			timeout: Math.min(loginAttemptSettleTimeoutMs, timeoutMs),
		})
		.catch(() => undefined)

	const pageMessage = await loginPageMessage(page)
	if (pageMessage) {
		if (isAuthChallengeMessage(pageMessage)) {
			await failWithPageContext(
				page,
				`Squarespace returned an authentication challenge that cannot be completed in CI. Login page message: ${pageMessage}`,
			)
		}

		return pageMessage
	}

	if (isSquarespaceLoginUrl(page.url())) {
		return 'Still on the Squarespace login page after submitting credentials.'
	}

	return null
}

async function verifyAcuitySession(page, url) {
	await gotoAcuityPage(page, url, 'Verifying Acuity session')

	if (isSquarespaceLoginUrl(page.url())) {
		return `Redirected back to Squarespace login when opening ${url}.`
	}

	const offerClassButton = await schedulingLocator(page, offerClassButtonSelector)
	try {
		await offerClassButton.first().waitFor({ state: 'visible', timeout: 45 * 1000 })
		return null
	} catch (error) {
		return `Acuity appointment editor did not load. Expected ${offerClassButtonSelector}. ${diagnostic(error.message)}`
	}
}

async function createStorageState() {
	const acuityUser = process.env.ACUITY_USER || ''
	const acuityPassword = process.env.ACUITY_PASSWORD || ''
	if (!acuityUser || !acuityPassword) {
		fail('Missing ACUITY_USER or ACUITY_PASSWORD.')
	}

	const verifyUrl = verificationUrl()
	const retryTimeoutMs = loginRetryTimeoutMs()
	const maxAttempts = loginMaxAttempts()
	const deadline = Date.now() + retryTimeoutMs
	let attempts = 0
	let lastProblem = 'No login problem was captured.'
	let lastPageContext = 'No page context was captured.'

	const browser = await chromium.launch({
		headless: process.env.ACUITY_HEADLESS !== 'false',
	})

	try {
		while (attempts < maxAttempts && remainingMs(deadline) > 0) {
			attempts += 1
			const context = await browser.newContext({
				storageState: {
					cookies: [],
					origins: [],
				},
			})
			const page = await context.newPage()
			let keepContext = false

			try {
				await gotoAcuityPage(page, verifyUrl, 'Opening Acuity login entry')

				if (isSquarespaceLoginUrl(page.url())) {
					await submitAcuityLogin(page, acuityUser, acuityPassword, Math.max(1, remainingMs(deadline)))
					const loginProblem = await waitForLoginAttempt(
						page,
						Math.max(1, Math.min(loginAttemptSettleTimeoutMs, remainingMs(deadline))),
					)
					if (loginProblem) {
						lastProblem = loginProblem
						lastPageContext = await pageContextMessage(page)
						console.log(
							`Acuity auth attempt ${attempts} was rejected; retrying while time remains. Message: ${diagnostic(loginProblem)}`,
						)
						continue
					}
				}

				const sessionProblem = await verifyAcuitySession(page, verifyUrl)
				if (!sessionProblem) {
					fs.mkdirSync(path.dirname(outputPath), { recursive: true })
					await context.storageState({ path: outputPath })
					keepContext = true
					console.log(`Acuity auth state created after ${attempts} attempt(s): ${outputPath}`)
					return
				}

				lastProblem = sessionProblem
				lastPageContext = await pageContextMessage(page)
				console.log(
					`Acuity auth attempt ${attempts} did not verify; retrying while time remains. Message: ${diagnostic(sessionProblem)}`,
				)
			} catch (error) {
				lastProblem = error instanceof Error ? error.message : String(error)
				lastPageContext = await pageContextMessage(page).catch(() => lastPageContext)
				if (isAuthChallengeMessage(lastProblem)) {
					throw error
				}
				console.log(
					`Acuity auth attempt ${attempts} failed; retrying while time remains. Message: ${diagnostic(lastProblem)}`,
				)
			} finally {
				if (!keepContext) {
					await context.close().catch(() => undefined)
				}
			}
		}
	} finally {
		await browser.close().catch(() => undefined)
	}

	fail(
		`Acuity auth state was not created after ${attempts}/${maxAttempts} attempt(s) within ${retryTimeoutMs}ms. Last page context: ${lastPageContext} Last problem: ${lastProblem}`,
	)
}

createStorageState().catch(error => {
	fail(error instanceof Error ? error.message : String(error))
})
