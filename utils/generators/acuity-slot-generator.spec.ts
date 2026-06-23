import { Browser, Locator, Page, test } from '@playwright/test'
const csvFilePath = process.env.ACUITY_SLOT_FILE || 'utils/delivery-slots.csv'
let csvToJson = require('convert-csv-to-json')
const fs = require('fs')

const schedulingFrameSelector = '[data-test="scheduling"], [data-test="scheduling-iframe"]'
const offerClassButtonSelector = '#offer-class-btn, [data-testid="offer-class"]'
const defaultLoginMaxAttempts = 5
const defaultLoginRetryTimeoutMs = defaultLoginMaxAttempts * 30 * 1000
const minimumLoginAttemptTimeoutMs = 8 * 1000
const loginAttemptSettleTimeoutMs = 15 * 1000
const pageLoadSettleTimeoutMs = 10 * 1000
const loginTypingDelayMs = 75
const defaultAcuityStorageStateFiles = [
	'.auth/acuity-storage-state.slim.json',
	'.auth/acuity-storage-state.json',
]
const requireStoredAcuityAuth = process.env.ACUITY_REQUIRE_STORAGE_STATE === 'true'

type AcuityStorageStateFile = {
	path: string
}

async function schedulingLocator(page: Page, selector: string): Promise<Locator> {
	if ((await page.locator(schedulingFrameSelector).count()) > 0) {
		return page.frameLocator(schedulingFrameSelector).locator(selector)
	}

	return page.locator(selector)
}

async function schedulingText(
	page: Page,
	text: string,
	options?: { exact?: boolean },
): Promise<Locator> {
	if ((await page.locator(schedulingFrameSelector).count()) > 0) {
		return page.frameLocator(schedulingFrameSelector).getByText(text, options)
	}

	return page.getByText(text, options)
}

function isSquarespaceLoginUrl(url: string): boolean {
	const normalizedUrl = url.toLowerCase()
	return (
		normalizedUrl.includes('login.squarespace.com') ||
		(normalizedUrl.includes('squarespace.com') && normalizedUrl.includes('/login'))
	)
}

function isAuthChallengeUrl(url: string): boolean {
	const normalizedUrl = url.toLowerCase()
	return [
		'captcha',
		'challenge',
		'mfa',
		'security-check',
		'two-factor',
		'verification',
	].some((fragment) => normalizedUrl.includes(fragment))
}

function isAuthChallengeMessage(message: string): boolean {
	const normalizedMessage = message.toLowerCase()
	return ['captcha', 'mfa', 'security-check', 'two-factor', 'verification'].some((fragment) =>
		normalizedMessage.includes(fragment),
	)
}

function loginRetryTimeoutMs(): number {
	const configuredTimeout = Number.parseInt(process.env.ACUITY_LOGIN_RETRY_TIMEOUT_MS || '', 10)
	return Number.isFinite(configuredTimeout) && configuredTimeout > 0
		? configuredTimeout
		: defaultLoginRetryTimeoutMs
}

function loginMaxAttempts(): number {
	const configuredAttempts = Number.parseInt(process.env.ACUITY_LOGIN_MAX_ATTEMPTS || '', 10)
	return Number.isFinite(configuredAttempts) && configuredAttempts > 0
		? configuredAttempts
		: defaultLoginMaxAttempts
}

function remainingLoginRetryMs(deadline: number): number {
	return Math.max(deadline - Date.now(), 0)
}

function loginDiagnostic(message: string): string {
	return message.replace(/\s+/g, ' ').trim().slice(0, 300)
}

function credentialDiagnostics(acuityUser: string, acuityPassword: string): string {
	const userDomain = acuityUser.includes('@') ? acuityUser.split('@').pop() : 'none'
	return [
		`userLength=${acuityUser.length}`,
		`userHasOuterWhitespace=${acuityUser !== acuityUser.trim()}`,
		`userDomain=${userDomain}`,
		`passwordLength=${acuityPassword.length}`,
		`passwordHasOuterWhitespace=${acuityPassword !== acuityPassword.trim()}`,
	].join(', ')
}

function acuityStorageStateFile(): AcuityStorageStateFile | null {
	const storageStateFile = process.env.ACUITY_STORAGE_STATE_FILE?.trim()
	if (storageStateFile) {
		return {
			path: storageStateFile,
		}
	}

	for (const candidate of defaultAcuityStorageStateFiles) {
		if (fs.existsSync(candidate)) {
			return {
				path: candidate,
			}
		}
	}

	return null
}

function requireAcuityCredentials(acuityUser: string, acuityPassword: string): void {
	const missing: string[] = []
	if (!acuityUser) {
		missing.push('ACUITY_USER')
	}
	if (!acuityPassword) {
		missing.push('ACUITY_PASSWORD')
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required Acuity secret(s): ${missing.join(', ')}. Provide ACUITY_STORAGE_STATE_FILE with a valid saved session, or provide Acuity username/password credentials for automated login fallback.`,
		)
	}
}

function requireStoredAcuityAuthState(): void {
	if (!requireStoredAcuityAuth) {
		return
	}

	throw new Error(
		'ACUITY_REQUIRE_STORAGE_STATE=true, but no valid stored Acuity auth state was available. Run npm run helper:acuityslots:auth and set ACUITY_STORAGE_STATE_FILE or ACUITY_STORAGE_STATE_B64 before running with multiple workers.',
	)
}

async function failWithPageContext(
	page: Page,
	message: string,
	cause?: unknown,
): Promise<never> {
	const contextMessage = await pageContextMessage(page)
	const causeMessage = cause instanceof Error ? ` ${cause.message}` : ''
	throw new Error(`${message} ${contextMessage}${causeMessage}`)
}

async function pageContextMessage(page: Page): Promise<string> {
	const title = await page.title().catch(() => 'unavailable')
	return `Current URL: ${page.url()}. Page title: ${title}.`
}

async function loginPageMessage(page: Page): Promise<string | null> {
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
	].some((fragment) => normalizedText.toLowerCase().includes(fragment))

	return hasLoginProblem ? normalizedText.slice(0, 300) : null
}

async function assertAcuityAccess(page: Page, context: string): Promise<void> {
	if (isSquarespaceLoginUrl(page.url())) {
		const pageMessage = await loginPageMessage(page)
		const message = pageMessage ? ` Login page message: ${pageMessage}` : ''
		await failWithPageContext(
			page,
			`${context}: Acuity login did not complete or the session expired.${message}`,
		)
	}

	if (isAuthChallengeUrl(page.url())) {
		await failWithPageContext(
			page,
			`${context}: Squarespace returned an authentication challenge that cannot be completed in CI.`,
		)
	}
}

async function submitAcuityLogin(
	page: Page,
	acuityUser: string,
	acuityPassword: string,
	timeoutMs: number,
): Promise<void> {
	const emailInput = page.locator('[placeholder="name\\@example\\.com"]')
	const passwordInput = page.locator('[placeholder="Password"]')
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

	await page.locator('[data-test="login-button"]').click({ timeout: timeoutMs })
}

async function waitForLoginAttempt(page: Page, timeoutMs: number): Promise<string | null> {
	await page
		.waitForURL((url) => !isSquarespaceLoginUrl(url.toString()), {
			timeout: timeoutMs,
		})
		.catch(() => undefined)

	await page
		.waitForLoadState('networkidle', {
			timeout: Math.min(loginAttemptSettleTimeoutMs, timeoutMs),
		})
		.catch(() => undefined)

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

	if (isSquarespaceLoginUrl(page.url())) {
		return 'Still on the Squarespace login page after submitting credentials.'
	}

	return null
}

async function verifyAcuitySession(page: Page, slotUrl: string): Promise<string | null> {
	await page.goto(slotUrl, { waitUntil: 'domcontentloaded' })
	await page
		.waitForLoadState('networkidle', { timeout: pageLoadSettleTimeoutMs })
		.catch(() => undefined)

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

	if (isSquarespaceLoginUrl(page.url())) {
		return `Redirected back to the Squarespace login page when opening Acuity slot ${slotUrl}.`
	}

	await waitForOfferClassButton(page, slotUrl)
	return null
}

async function openAcuityLoginEntry(page: Page, slotUrl: string, timeoutMs: number): Promise<void> {
	await page.goto(slotUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
	await page
		.waitForLoadState('networkidle', {
			timeout: Math.min(pageLoadSettleTimeoutMs, timeoutMs),
		})
		.catch(() => undefined)

	if (isAuthChallengeUrl(page.url())) {
		await failWithPageContext(
			page,
			'Squarespace returned an authentication challenge that cannot be completed in CI.',
		)
	}
}

async function newCleanAcuityPage(browser: Browser): Promise<Page> {
	const context = await browser.newContext({
		storageState: {
			cookies: [],
			origins: [],
		},
	})
	await context.clearCookies()
	return context.newPage()
}

async function closePageContext(page?: Page): Promise<void> {
	await page?.context().close().catch(() => undefined)
}

async function pageFromStoredAcuitySession(
	browser: Browser,
	verificationSlotUrl: string,
): Promise<Page | null> {
	const storageStateFile = acuityStorageStateFile()
	if (!storageStateFile) {
		return null
	}

	if (!fs.existsSync(storageStateFile.path)) {
		throw new Error(
			`Acuity storage state file does not exist: ${storageStateFile.path}.`,
		)
	}

	let page: Page | undefined
	let keepContext = false

	try {
		const context = await browser.newContext({ storageState: storageStateFile.path })
		page = await context.newPage()

		const sessionProblem = await verifyAcuitySession(page, verificationSlotUrl)
		if (!sessionProblem) {
			keepContext = true
			console.log(`Using stored Acuity auth state from ${storageStateFile.path}.`)
			return page
		}

		console.log(
			`Stored Acuity auth state from ${storageStateFile.path} did not verify; falling back to login automation. Message: ${loginDiagnostic(sessionProblem)}`,
		)
		return null
	} catch (error) {
		if (isNonRetryableAuthError(error)) {
			throw error
		}

		const errorMessage = error instanceof Error ? error.message : String(error)
		console.log(
			`Stored Acuity auth state from ${storageStateFile.path} failed; falling back to login automation. Message: ${loginDiagnostic(errorMessage)}`,
		)
		return null
	} finally {
		if (!keepContext) {
			await closePageContext(page)
		}
	}
}

function isNonRetryableAuthError(error: unknown): boolean {
	return (
		error instanceof Error &&
		error.message.includes('authentication challenge that cannot be completed in CI')
	)
}

async function loginToAcuityWithRetry(
	browser: Browser,
	acuityUser: string,
	acuityPassword: string,
	verificationSlotUrl: string,
): Promise<Page> {
	const storedSessionPage = await pageFromStoredAcuitySession(browser, verificationSlotUrl)
	if (storedSessionPage) {
		return storedSessionPage
	}

	requireStoredAcuityAuthState()
	requireAcuityCredentials(acuityUser, acuityPassword)

	const retryTimeoutMs = loginRetryTimeoutMs()
	const maxAttempts = loginMaxAttempts()
	const deadline = Date.now() + retryTimeoutMs
	let attempts = 0
	let lastLoginProblem = 'No login rejection message was captured.'
	let lastPageContext = 'No page context was captured.'

	while (attempts < maxAttempts && remainingLoginRetryMs(deadline) > 0) {
		if (attempts > 0 && remainingLoginRetryMs(deadline) < minimumLoginAttemptTimeoutMs) {
			break
		}

		attempts += 1
		let attemptPage: Page | undefined
		let keepAttemptContext = false

		try {
			attemptPage = await newCleanAcuityPage(browser)
			await openAcuityLoginEntry(
				attemptPage,
				verificationSlotUrl,
				Math.max(1, remainingLoginRetryMs(deadline)),
			)

			if (isSquarespaceLoginUrl(attemptPage.url())) {
				if (attempts === 1) {
					console.log(
						`Acuity credential diagnostics: ${credentialDiagnostics(acuityUser, acuityPassword)}`,
					)
				}

				await submitAcuityLogin(
					attemptPage,
					acuityUser,
					acuityPassword,
					Math.max(1, remainingLoginRetryMs(deadline)),
				)

				const loginProblem = await waitForLoginAttempt(
					attemptPage,
					Math.max(
						1,
						Math.min(loginAttemptSettleTimeoutMs, remainingLoginRetryMs(deadline)),
					),
				)
				if (loginProblem) {
					lastLoginProblem = loginProblem
					lastPageContext = await pageContextMessage(attemptPage)
					console.log(
						`Acuity login attempt ${attempts} was rejected in a clean context; retrying while time remains. Message: ${loginDiagnostic(loginProblem)}`,
					)
					continue
				}
			}

			const sessionProblem = await verifyAcuitySession(attemptPage, verificationSlotUrl)
			if (!sessionProblem) {
				keepAttemptContext = true
				console.log(`Acuity login succeeded after ${attempts} attempt(s).`)
				return attemptPage
			}

			lastLoginProblem = sessionProblem
			lastPageContext = await pageContextMessage(attemptPage)
			console.log(
				`Acuity session verification failed after attempt ${attempts} in a clean context; retrying while time remains. Message: ${loginDiagnostic(sessionProblem)}`,
			)
		} catch (error) {
			if (isNonRetryableAuthError(error)) {
				throw error
			}

			lastLoginProblem = error instanceof Error ? error.message : String(error)
			if (attemptPage) {
				lastPageContext = await pageContextMessage(attemptPage).catch(() => lastPageContext)
			}
			console.log(
				`Acuity login attempt ${attempts} failed in a clean context; retrying while time remains. Message: ${loginDiagnostic(lastLoginProblem)}`,
			)
		} finally {
			if (!keepAttemptContext) {
				await closePageContext(attemptPage)
			}
		}
	}

	throw new Error(
		`Acuity login did not complete after ${attempts}/${maxAttempts} attempt(s) within ${retryTimeoutMs}ms. Last page context: ${lastPageContext} Last login page message: ${lastLoginProblem}`,
	)
}

async function openAcuitySlotPage(page: Page, slotUrl: string): Promise<void> {
	await page.goto(slotUrl, { waitUntil: 'domcontentloaded' })
	await page.waitForLoadState('networkidle', { timeout: 10 * 1000 }).catch(() => undefined)
	await assertAcuityAccess(page, `Opening Acuity slot ${slotUrl}`)
}

async function waitForOfferClassButton(page: Page, slotUrl: string): Promise<Locator> {
	const offerClassButton = await schedulingLocator(page, offerClassButtonSelector)

	try {
		await offerClassButton.first().waitFor({ state: 'visible', timeout: 45 * 1000 })
	} catch (error) {
		await assertAcuityAccess(page, `Loading Acuity slot ${slotUrl}`)
		await failWithPageContext(
			page,
			`Acuity appointment editor did not load for ${slotUrl}. Expected ${offerClassButtonSelector}.`,
			error,
		)
	}

	return offerClassButton
}

test.describe('Acuity Automation', () => {
	test.describe.configure({ mode: 'parallel' })

	const slots = csvToJson.fieldDelimiter(';').getJsonFromCsv(csvFilePath)

	for (let index = 0; index < slots.length; index++) {
		const slot = slots[index]
		test(`Add Acuity Slots: ${slot.Partner_region_zone};${slot.AppointmentID};${slot.URL};${slot.DateOffered};${slot.CalendarName};${slot.TimeOffered};${slot.LinkText};${slot.Availability} @helper`, async ({ browser }, workerInfo) => {
			test.skip(workerInfo.project.name === 'Mobile Chrome')

			let page: Page | undefined
			try {
				await test.step('Open authenticated Acuity session', async () => {
					const acuityUser = process.env.ACUITY_USER || ''
					const acuityPassword = process.env.ACUITY_PASSWORD || ''

					page = await loginToAcuityWithRetry(browser, acuityUser, acuityPassword, slot.URL)
				})

				await test.step(`Create Slot on ${slot.DateOffered} - ${slot.TimeOffered}`, async () => {
					if (!page) {
						throw new Error('Acuity page was not initialized.')
					}

					//Navigate to Zone
					await openAcuitySlotPage(page, slot.URL)

					// Start Create Slot
					const offerClassButton = await waitForOfferClassButton(page, slot.URL)
					await offerClassButton.first().click()
					// Select "Another Test Calendar"
					const calendarSelect = await schedulingLocator(page, 'select[name="calendar"]')
					await calendarSelect.selectOption({ label: slot.CalendarName })
					// Date Selector
					// Select Day of Month
					const dateInput = await schedulingLocator(page, '#date-input')
					await dateInput.fill(`${slot.DateOffered}`)

					// Select Time
					const timeInput = await schedulingLocator(page, '[placeholder="Ex\\. 9\\:00am"]')
					await timeInput.click()
					await timeInput.fill(`${slot.TimeOffered}`)
					// Save Class
					const saveClassButton = await schedulingText(page, 'Save Class')
					await Promise.all([
						page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
						saveClassButton.click(),
					])

					//Edit Capacity
					//Select Slot
					//Prevent 12PM and 2PM collison
					const slotLink = await schedulingText(page, `${slot.LinkText}`, { exact: true })
					await slotLink.click()

					// Click Edit
					const editButton = await schedulingText(page, 'Edit')
					await editButton.click()

					// Edit Capacity Value
					const capacityInput = await schedulingLocator(
						page,
						'text=Max number of people for this class >> input[name="group_max"]',
					)
					await capacityInput.click()
					await capacityInput.fill(slot.Availability)

					// Save Slot
					const saveChangesButton = await schedulingText(page, 'Save Changes')
					await saveChangesButton.click()
				})
			} finally {
				await closePageContext(page)
			}
		})
	}
})

// //Partner;Partner_region_zone;Appointment ID;URL;Calendar Name;Date Offered;Time Offered;Link Text;Availability
// const fields = [
// 	'Partner',
// 	'Partner_region_zone',
// 	'Appointment ID',
// 	'URL',
// 	'Calendar Name',
// 	'Date Offered',
// 	'Link Text',
// 	'Availability',
// ]
// const opts = { fields }
// const parser = new Parser(opts)
// const csv = parser.parse(slots[index])
