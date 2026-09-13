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
const acuityAuthFlowMaxSteps = 12
const acuityAuthStateTimeoutMs = 1500
const defaultAcuityLoginMethod = 'squarespace'
const acuityAccountName = '710 Labs'
const acuityAccountDomain = 'https://710labs.as.me/'
const acuityAccountWebsiteId = '61329f74039b125588bb305f'
const outputPath = process.env.ACUITY_STORAGE_STATE_FILE || '.auth/acuity-storage-state.json'
const authArtifactDir = process.env.ACUITY_AUTH_ARTIFACT_DIR || path.join('test-results', 'acuity-auth')
const captureAuthArtifacts =
	['1', 'true', 'yes'].includes(
		String(process.env.ACUITY_AUTH_DEBUG_ARTIFACTS || '').toLowerCase(),
	) || process.env.CI === 'true'
const captureAuthTraces = ['1', 'true', 'yes'].includes(
	String(process.env.ACUITY_AUTH_TRACE || '').toLowerCase(),
)
const authVideoSize = { width: 1280, height: 720 }

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

function normalizedPageText(value) {
	return String(value).replace(/\s+/g, ' ').trim()
}

function isLoggedOutNoticeText(value) {
	const normalizedText = normalizedPageText(value)
	return /we(?:'|’)ve logged you out due to inactivity|automatically logged out after a period of inactivity/i.test(
		normalizedText,
	)
}

function isOptionalEmailVerificationText(value) {
	const normalizedText = normalizedPageText(value)
	return /verify your email address/i.test(normalizedText)
}

function isAcuityAccountSelectionText(value) {
	return /select an account to continue/i.test(normalizedPageText(value))
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function artifactRelativePath(filePath) {
	return path.relative(authArtifactDir, filePath).split(path.sep).join('/')
}

function safeFileSegment(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
}

function prepareAuthArtifactDir() {
	if (!captureAuthArtifacts) {
		return
	}

	fs.rmSync(authArtifactDir, { recursive: true, force: true })
	fs.mkdirSync(authArtifactDir, { recursive: true })
}

function createAttemptRecord(attempt) {
	const attemptId = String(attempt).padStart(2, '0')
	const attemptDir = path.join(authArtifactDir, `attempt-${attemptId}`)

	if (captureAuthArtifacts) {
		fs.mkdirSync(attemptDir, { recursive: true })
	}

	return {
		attempt,
		attemptDir,
		bodyTextPath: null,
		htmlPath: null,
		pageContext: null,
		problem: null,
		screenshotPath: null,
		status: 'started',
		title: null,
		tracePath: null,
		traceStarted: false,
		url: null,
		videoPaths: [],
	}
}

function writeAuthDebugReport(attemptRecords, summary) {
	if (!captureAuthArtifacts) {
		return
	}

	fs.mkdirSync(authArtifactDir, { recursive: true })

	const serializableRecords = attemptRecords.map(({ attemptDir, traceStarted, ...record }) => record)
	fs.writeFileSync(
		path.join(authArtifactDir, 'attempts.json'),
		JSON.stringify({ summary, attempts: serializableRecords }, null, 2),
	)

	const rows = serializableRecords
		.map(record => {
			const links = []
			if (record.screenshotPath) {
				links.push(`<a href="${escapeHtml(record.screenshotPath)}">screenshot</a>`)
			}
			for (const videoPath of record.videoPaths) {
				links.push(`<a href="${escapeHtml(videoPath)}">video</a>`)
			}
			if (record.tracePath) {
				links.push(`<a href="${escapeHtml(record.tracePath)}">trace</a>`)
			}
			if (record.htmlPath) {
				links.push(`<a href="${escapeHtml(record.htmlPath)}">html</a>`)
			}
			if (record.bodyTextPath) {
				links.push(`<a href="${escapeHtml(record.bodyTextPath)}">text</a>`)
			}

			const videoEmbeds = record.videoPaths
				.map(
					videoPath =>
						`<video src="${escapeHtml(videoPath)}" controls preload="metadata"></video>`,
				)
				.join('')

			return `
				<tr>
					<td>${record.attempt}</td>
					<td>${escapeHtml(record.status)}</td>
					<td>${escapeHtml(record.url || '')}</td>
					<td>${escapeHtml(record.title || '')}</td>
					<td>${escapeHtml(record.problem || '')}</td>
					<td>${links.join(' | ')}</td>
				</tr>
				${videoEmbeds ? `<tr><td colspan="6">${videoEmbeds}</td></tr>` : ''}
			`
		})
		.join('\n')

	fs.writeFileSync(
		path.join(authArtifactDir, 'index.html'),
		`<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>Acuity Auth Debug Report</title>
	<style>
		body { color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; }
		code, pre { background: #f3f4f6; border-radius: 4px; padding: 2px 4px; }
		table { border-collapse: collapse; width: 100%; }
		th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
		th { background: #f9fafb; }
		video { display: block; margin: 8px 0; max-width: 960px; width: 100%; }
	</style>
</head>
<body>
	<h1>Acuity Auth Debug Report</h1>
	<p><strong>Status:</strong> ${escapeHtml(summary.status || 'unknown')}</p>
	<p><strong>Verification URL:</strong> <code>${escapeHtml(summary.verifyUrl || '')}</code></p>
	${summary.message ? `<p><strong>Message:</strong> ${escapeHtml(summary.message)}</p>` : ''}
	<table>
		<thead>
			<tr>
				<th>Attempt</th>
				<th>Status</th>
				<th>URL</th>
				<th>Title</th>
				<th>Problem</th>
				<th>Artifacts</th>
			</tr>
		</thead>
		<tbody>${rows}</tbody>
	</table>
</body>
</html>
`,
	)
}

function isSquarespaceLoginUrl(url) {
	const normalizedUrl = url.toLowerCase()
	return (
		normalizedUrl.includes('login.squarespace.com') ||
		(normalizedUrl.includes('squarespace.com') && normalizedUrl.includes('/login'))
	)
}

function isAcuityUrl(url) {
	try {
		const hostname = new URL(url).hostname
		return hostname === 'acuityscheduling.com' || hostname.endsWith('.acuityscheduling.com')
	} catch {
		return false
	}
}

function acuityLoginMethod() {
	const configuredMethod = String(
		process.env.ACUITY_LOGIN_METHOD || defaultAcuityLoginMethod,
	).toLowerCase()

	if (!['acuity', 'squarespace'].includes(configuredMethod)) {
		throw new Error(
			`Unsupported ACUITY_LOGIN_METHOD: ${configuredMethod}. Expected "squarespace" or "acuity".`,
		)
	}

	return configuredMethod
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

async function captureAttemptPageArtifacts(page, record, label) {
	if (!captureAuthArtifacts) {
		return
	}

	const safeLabel = safeFileSegment(label) || 'page'
	record.url = page.url()
	record.title = await page.title().catch(() => 'unavailable')
	record.pageContext = await pageContextMessage(page).catch(() => null)

	const screenshotPath = path.join(record.attemptDir, `${safeLabel}.png`)
	if (
		await page
			.screenshot({ path: screenshotPath, fullPage: true, timeout: 5000 })
			.then(() => true)
			.catch(() => false)
	) {
		record.screenshotPath = artifactRelativePath(screenshotPath)
	}

	const htmlPath = path.join(record.attemptDir, `${safeLabel}.html`)
	const html = await page.content().catch(() => null)
	if (html !== null) {
		fs.writeFileSync(htmlPath, html)
		record.htmlPath = artifactRelativePath(htmlPath)
	}

	const bodyTextPath = path.join(record.attemptDir, `${safeLabel}.txt`)
	const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => null)
	if (bodyText !== null) {
		fs.writeFileSync(bodyTextPath, bodyText)
		record.bodyTextPath = artifactRelativePath(bodyTextPath)
	}
}

async function closeContextWithArtifacts(context, page, record, reportSummary) {
	if (!captureAuthArtifacts) {
		await context.close().catch(() => undefined)
		return
	}

	await captureAttemptPageArtifacts(page, record, record.status)

	if (record.traceStarted) {
		const tracePath = path.join(record.attemptDir, 'trace.zip')
		if (
			await context.tracing
				.stop({ path: tracePath })
				.then(() => true)
				.catch(() => false)
		) {
			record.tracePath = artifactRelativePath(tracePath)
		}
	}

	const videos = context
		.pages()
		.map(currentPage => currentPage.video())
		.filter(Boolean)

	await context.close().catch(() => undefined)

	for (const video of videos) {
		const videoPath = await video.path().catch(() => null)
		if (videoPath && fs.existsSync(videoPath)) {
			record.videoPaths.push(artifactRelativePath(videoPath))
		}
	}

	writeAuthDebugReport(reportSummary.attemptRecords, reportSummary.summary)
}

async function failWithPageContext(page, message, cause) {
	const contextMessage = await pageContextMessage(page)
	const causeMessage = cause instanceof Error ? ` ${cause.message}` : ''
	throw new Error(`${message} ${contextMessage}${causeMessage}`)
}

async function dismissAcuityInterruptions(page) {
	await page.keyboard.press('Escape').catch(() => undefined)

	for (const selector of [
		'[role="alert"] button[aria-label="Close"]',
		'.alert button.close',
		'.alert [data-dismiss="alert"]',
		'[class*="notice"] button[aria-label="Close"]',
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

async function pageBodyText(page, timeoutMs = 2000) {
	return page
		.locator('body')
		.innerText({ timeout: timeoutMs })
		.catch(() => '')
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
	if (!isSquarespaceLoginUrl(page.url()) && !isAcuityUrl(page.url())) {
		return null
	}

	const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '')
	const normalizedText = bodyText.replace(/\s+/g, ' ').trim()
	if (!normalizedText) {
		return null
	}

	const hasLoginProblem = [
		'captcha',
		"couldn't find",
		'couldn’t find',
		"doesn't exist",
		'doesn’t exist',
		'incorrect',
		'invalid',
		'not recognized',
		'try again',
		'two-factor',
		'unable to log in',
		'verification',
	].some(fragment => normalizedText.toLowerCase().includes(fragment))

	return hasLoginProblem ? normalizedText.slice(0, 300) : null
}

async function firstVisibleLocator(locators, timeoutMs = acuityAuthStateTimeoutMs) {
	for (const locator of locators) {
		const candidate = locator.first()
		if (await candidate.isVisible({ timeout: timeoutMs }).catch(() => false)) {
			return candidate
		}
	}

	return null
}

async function authEmailInput(page) {
	return firstVisibleLocator([
		page.getByRole('textbox', { name: /^(username|email|email address)$/i }),
		page.locator('[placeholder="name\\@example\\.com"]'),
		page.locator('input[type="email"]'),
		page.locator('input[name="username"]'),
		page.locator('input[name="email"]'),
		page.locator('input[autocomplete="username"]'),
	])
}

async function authPasswordInput(page) {
	return firstVisibleLocator([
		page.getByRole('textbox', { name: /^password$/i }),
		page.locator('[placeholder="Password"]'),
		page.locator('input[type="password"]'),
		page.locator('input[autocomplete="current-password"]'),
	])
}

async function authSubmitButton(page, names) {
	return firstVisibleLocator([
		page.locator('[data-test="login-button"]'),
		page.getByRole('button', { name: names }),
		page.locator('button[type="submit"]'),
		page.locator('input[type="submit"]'),
	])
}

async function fillAndVerifyAuthInput(input, value, label, timeoutMs) {
	await input.fill('', { timeout: timeoutMs })
	await input.pressSequentially(value, {
		delay: loginTypingDelayMs,
		timeout: timeoutMs,
	})

	const enteredValue = await input
		.inputValue({ timeout: Math.min(timeoutMs, acuityAuthStateTimeoutMs) })
		.catch(() => null)
	if (enteredValue === null) {
		return false
	}
	if (enteredValue !== value) {
		throw new Error(
			`Acuity ${label} field did not match the configured value after typing. Expected length ${value.length}, actual length ${enteredValue.length}.`,
		)
	}

	return true
}

async function waitForAuthTransition(page, timeoutMs) {
	await page
		.waitForLoadState('domcontentloaded', {
			timeout: Math.min(timeoutMs, pageLoadSettleTimeoutMs),
		})
		.catch(() => undefined)
	await page
		.waitForLoadState('networkidle', {
			timeout: Math.min(timeoutMs, pageLoadSettleTimeoutMs),
		})
		.catch(() => undefined)
	await page.waitForTimeout(500).catch(() => undefined)
}

async function submitEmailFirstLoginStep(page, emailInput, acuityUser, timeoutMs) {
	const normalizedAcuityUser = acuityUser.trim()
	const inputRemainedVisible = await fillAndVerifyAuthInput(
		emailInput,
		normalizedAcuityUser,
		'username',
		timeoutMs,
	)
	if (!inputRemainedVisible) {
		await waitForAuthTransition(page, timeoutMs)
		return
	}

	const nextButton = await authSubmitButton(page, /^(next|continue)$/i)
	if (!nextButton) {
		throw new Error('Acuity email login step did not expose a Next or Continue button.')
	}

	await page.waitForTimeout(300)
	await nextButton.click({ timeout: timeoutMs })
	await waitForAuthTransition(page, timeoutMs)
}

async function submitPasswordLoginStep(
	page,
	emailInput,
	passwordInput,
	acuityUser,
	acuityPassword,
	timeoutMs,
) {
	if (emailInput) {
		const normalizedAcuityUser = acuityUser.trim()
		const currentEmail = await emailInput
			.inputValue({ timeout: Math.min(timeoutMs, acuityAuthStateTimeoutMs) })
			.catch(() => null)
		if (currentEmail === null) {
			await waitForAuthTransition(page, timeoutMs)
			return false
		}

		if (currentEmail !== normalizedAcuityUser) {
			const emailInputRemainedVisible = await fillAndVerifyAuthInput(
				emailInput,
				normalizedAcuityUser,
				'username',
				timeoutMs,
			)
			if (!emailInputRemainedVisible) {
				await waitForAuthTransition(page, timeoutMs)
				return false
			}

			passwordInput = await authPasswordInput(page)
			if (!passwordInput) {
				await waitForAuthTransition(page, timeoutMs)
				return false
			}
		}
	}

	const passwordInputRemainedVisible = await fillAndVerifyAuthInput(
		passwordInput,
		acuityPassword,
		'password',
		timeoutMs,
	)
	if (!passwordInputRemainedVisible) {
		await waitForAuthTransition(page, timeoutMs)
		return false
	}

	const loginButton = await authSubmitButton(page, /^(log in|login|sign in|next|continue)$/i)
	if (!loginButton) {
		throw new Error('Acuity password login step did not expose a submit button.')
	}

	await page.waitForTimeout(300)
	await loginButton.click({ timeout: timeoutMs })
	await waitForAuthTransition(page, timeoutMs)
	return true
}

async function continueWithConfiguredLoginMethod(page, timeoutMs) {
	const squarespaceChoice = await firstVisibleLocator([
		page.getByRole('button', { name: /^continue with squarespace$/i }),
		page.getByRole('link', { name: /^continue with squarespace$/i }),
	])
	const acuityChoice = await firstVisibleLocator([
		page.getByRole('button', { name: /^continue with acuity scheduling$/i }),
		page.getByRole('link', { name: /^continue with acuity scheduling$/i }),
	])

	if (!squarespaceChoice && !acuityChoice) {
		return null
	}

	const configuredMethod = acuityLoginMethod()
	const useSquarespace =
		(configuredMethod === 'squarespace' && squarespaceChoice) || !acuityChoice
	const selectedChoice = useSquarespace ? squarespaceChoice : acuityChoice
	const selectedMethod = useSquarespace ? 'squarespace' : 'acuity'

	console.log(`Continuing Acuity authentication with ${selectedMethod}.`)
	await selectedChoice.click({ timeout: timeoutMs })
	await waitForAuthTransition(page, timeoutMs)
	return selectedMethod
}

async function skipOptionalEmailVerification(page, timeoutMs) {
	const bodyText = await pageBodyText(page, Math.min(timeoutMs, 2000))
	if (!isOptionalEmailVerificationText(bodyText)) {
		return false
	}

	const skipButton = await firstVisibleLocator(
		[
			page.getByRole('button', { name: /^skip$/i }),
			page.getByRole('link', { name: /^skip$/i }),
			page.locator('[role="button"]:has-text("SKIP")'),
			page.locator('button:has-text("SKIP"), a:has-text("SKIP")'),
			page.getByText(/^skip$/i),
		],
		Math.min(timeoutMs, acuityAuthStateTimeoutMs),
	)
	if (!skipButton) {
		throw new Error(
			'Squarespace displayed the optional email-verification screen but did not expose its Skip control.',
		)
	}

	console.log('Skipping optional Squarespace email verification.')
	await skipButton.click({ timeout: timeoutMs })
	await waitForAuthTransition(page, timeoutMs)
	return true
}

async function selectAcuityAccount(page, timeoutMs) {
	const bodyText = await pageBodyText(page, Math.min(timeoutMs, 2000))
	if (!isAcuityAccountSelectionText(bodyText)) {
		return false
	}

	const accountNamePattern = new RegExp(`^${acuityAccountName}$`, 'i')
	const accountNameLocator = page
		.locator('.scheduling-instance__card-name')
		.filter({ hasText: accountNamePattern })
	const accountCard = await firstVisibleLocator(
		[
			page.locator(
				`.scheduling-instance__card[onclick*="website_id=${acuityAccountWebsiteId}"]`,
			),
			page.getByRole('button', { name: /710 Labs/i }),
			page.locator('.scheduling-instance__card').filter({ has: accountNameLocator }),
		],
		Math.min(timeoutMs, acuityAuthStateTimeoutMs),
	)

	if (!accountCard) {
		const availableAccounts = await page
			.locator('.scheduling-instance__card-name')
			.allTextContents()
			.catch(() => [])
		throw new Error(
			`Acuity displayed its account chooser, but the ${acuityAccountName} account (${acuityAccountDomain}) was not available. Available accounts: ${availableAccounts.join(', ') || 'none detected'}.`,
		)
	}

	console.log(`Selecting the ${acuityAccountName} Acuity account (${acuityAccountDomain}).`)
	await accountCard.click({ timeout: timeoutMs })
	await waitForAuthTransition(page, timeoutMs)
	return true
}

async function isAcuityEditorReady(page, timeoutMs = acuityAuthStateTimeoutMs) {
	const offerClassButton = await schedulingLocator(page, offerClassButtonSelector)
	return offerClassButton
		.first()
		.isVisible({ timeout: timeoutMs })
		.catch(() => false)
}

async function authPageDescription(page) {
	const bodyText = await pageBodyText(page)
	const normalizedText = normalizedPageText(bodyText)

	if (isOptionalEmailVerificationText(normalizedText)) {
		return 'optional Squarespace email-verification page'
	}
	if (isAcuityAccountSelectionText(normalizedText)) {
		return 'Acuity account-selection page'
	}
	if (isLoggedOutNoticeText(normalizedText)) {
		return 'expired Acuity session page'
	}
	if (/continue with squarespace|continue with acuity scheduling/i.test(normalizedText)) {
		return 'Acuity login-method choice page'
	}
	if (/log in to acuity scheduling/i.test(normalizedText)) {
		return 'Acuity login page'
	}
	if (isSquarespaceLoginUrl(page.url())) {
		return 'Squarespace login page'
	}

	return null
}

async function completeAcuityAuthentication(
	page,
	acuityUser,
	acuityPassword,
	verificationUrl,
	timeoutMs,
) {
	const deadline = Date.now() + timeoutMs
	const stageCounts = new Map()
	let revisitedEditor = false
	let selectedLoginMethod = null
	let selectedAccount = false
	let submittedCredentials = false

	for (let step = 1; step <= acuityAuthFlowMaxSteps && remainingMs(deadline) > 0; step++) {
		if (await isAcuityEditorReady(page)) {
			return null
		}

		const stepTimeoutMs = Math.max(
			1,
			Math.min(loginAttemptSettleTimeoutMs, remainingMs(deadline)),
		)

		await dismissAcuityInterruptions(page)

		if (await skipOptionalEmailVerification(page, stepTimeoutMs)) {
			continue
		}

		if (await selectAcuityAccount(page, stepTimeoutMs)) {
			selectedAccount = true
			continue
		}

		if (isAuthChallengeUrl(page.url())) {
			await failWithPageContext(
				page,
				'Squarespace returned an authentication challenge that cannot be completed in CI.',
			)
		}

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

		const continuedLoginMethod = await continueWithConfiguredLoginMethod(page, stepTimeoutMs)
		if (continuedLoginMethod) {
			selectedLoginMethod = continuedLoginMethod
			continue
		}

		const emailInput = await authEmailInput(page)
		const passwordInput = await authPasswordInput(page)
		const pageDescription = await authPageDescription(page)
		if (
			submittedCredentials &&
			emailInput &&
			!passwordInput &&
			pageDescription?.includes('Acuity')
		) {
			return `The ${selectedLoginMethod || 'selected'} credentials returned to the Acuity login page instead of opening the appointment editor. Confirm that ACUITY_USER and ACUITY_PASSWORD match that login provider.`
		}
		const stage = passwordInput
			? emailInput
				? 'combined-credentials'
				: 'password'
			: emailInput
				? 'email'
				: pageDescription || 'unknown'
		const stageCount = (stageCounts.get(stage) || 0) + 1
		stageCounts.set(stage, stageCount)

		if (stageCount > 2) {
			return `Acuity authentication stalled on the ${stage} step. ${await pageContextMessage(page)}`
		}

		if (passwordInput) {
			submittedCredentials = await submitPasswordLoginStep(
				page,
				emailInput,
				passwordInput,
				acuityUser,
				acuityPassword,
				stepTimeoutMs,
			)
			continue
		}

		if (emailInput) {
			await submitEmailFirstLoginStep(page, emailInput, acuityUser, stepTimeoutMs)
			continue
		}

		if (!revisitedEditor) {
			revisitedEditor = true
			if (selectedAccount) {
				console.log(
					`${acuityAccountName} account selected; opening the appointment editor to verify the authenticated session.`,
				)
			}
			await gotoAcuityPage(page, verificationUrl, 'Returning to Acuity after login')
			continue
		}

		return `Acuity authentication reached an unsupported page${pageDescription ? ` (${pageDescription})` : ''}. ${await pageContextMessage(page)}`
	}

	return `Acuity authentication did not complete within ${timeoutMs}ms. ${await pageContextMessage(page)}`
}

async function verifyAcuitySession(page, url) {
	await gotoAcuityPage(page, url, 'Verifying Acuity session')

	const authDescription = await authPageDescription(page)
	if (authDescription) {
		return `Reached the ${authDescription} instead of the Acuity appointment editor when opening ${url}.`
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

	prepareAuthArtifactDir()

	const verifyUrl = verificationUrl()
	const retryTimeoutMs = loginRetryTimeoutMs()
	const maxAttempts = loginMaxAttempts()
	const deadline = Date.now() + retryTimeoutMs
	let attempts = 0
	let lastProblem = 'No login problem was captured.'
	let lastPageContext = 'No page context was captured.'
	const attemptRecords = []

	const browser = await chromium.launch({
		headless: process.env.ACUITY_HEADLESS !== 'false',
	})

	try {
		while (attempts < maxAttempts && remainingMs(deadline) > 0) {
			attempts += 1
			const attemptRecord = createAttemptRecord(attempts)
			attemptRecords.push(attemptRecord)
			const contextOptions = {
				storageState: {
					cookies: [],
					origins: [],
				},
			}
			if (captureAuthArtifacts) {
				contextOptions.recordVideo = {
					dir: attemptRecord.attemptDir,
					size: authVideoSize,
				}
			}

			const context = await browser.newContext(contextOptions)
			if (captureAuthArtifacts && captureAuthTraces) {
				await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
				attemptRecord.traceStarted = true
			}
			const page = await context.newPage()

			try {
				await gotoAcuityPage(page, verifyUrl, 'Opening Acuity login entry')

				const loginProblem = await completeAcuityAuthentication(
					page,
					acuityUser,
					acuityPassword,
					verifyUrl,
					Math.max(1, remainingMs(deadline)),
				)
				if (loginProblem) {
					lastProblem = loginProblem
					lastPageContext = await pageContextMessage(page)
					attemptRecord.status = 'login-rejected'
					attemptRecord.problem = loginProblem
					console.log(
						`Acuity auth attempt ${attempts} was rejected; retrying while time remains. Message: ${diagnostic(loginProblem)}`,
					)
					continue
				}

				const sessionProblem = await verifyAcuitySession(page, verifyUrl)
				if (!sessionProblem) {
					fs.mkdirSync(path.dirname(outputPath), { recursive: true })
					await context.storageState({ path: outputPath })
					attemptRecord.status = 'success'
					console.log(`Acuity auth state created after ${attempts} attempt(s): ${outputPath}`)
					return
				}

				lastProblem = sessionProblem
				lastPageContext = await pageContextMessage(page)
				attemptRecord.status = 'not-verified'
				attemptRecord.problem = sessionProblem
				console.log(
					`Acuity auth attempt ${attempts} did not verify; retrying while time remains. Message: ${diagnostic(sessionProblem)}`,
				)
			} catch (error) {
				lastProblem = error instanceof Error ? error.message : String(error)
				lastPageContext = await pageContextMessage(page).catch(() => lastPageContext)
				attemptRecord.status = isAuthChallengeMessage(lastProblem) ? 'hard-failure' : 'error'
				attemptRecord.problem = lastProblem
				if (isAuthChallengeMessage(lastProblem)) {
					throw error
				}
				console.log(
					`Acuity auth attempt ${attempts} failed; retrying while time remains. Message: ${diagnostic(lastProblem)}`,
				)
			} finally {
				await closeContextWithArtifacts(context, page, attemptRecord, {
					attemptRecords,
					summary: {
						message: attemptRecord.problem,
						status: attemptRecord.status,
						verifyUrl,
					},
				})
			}
		}
	} finally {
		await browser.close().catch(() => undefined)
	}

	const finalMessage = `Acuity auth state was not created after ${attempts}/${maxAttempts} attempt(s) within ${retryTimeoutMs}ms. Last page context: ${lastPageContext} Last problem: ${lastProblem}`
	writeAuthDebugReport(attemptRecords, {
		message: finalMessage,
		status: 'failed',
		verifyUrl,
	})
	fail(finalMessage)
}

if (require.main === module) {
	createStorageState().catch(error => {
		fail(error instanceof Error ? error.message : String(error))
	})
}

module.exports = {
	acuityLoginMethod,
	authPageDescription,
	isAcuityAccountSelectionText,
	isAcuityUrl,
	isLoggedOutNoticeText,
	isOptionalEmailVerificationText,
	isSquarespaceLoginUrl,
}
