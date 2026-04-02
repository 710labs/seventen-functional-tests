const path = require('path')

const DRIVER_LICENSE_FILES = ['CA-DL.heic', 'CA-DL.jpg', 'CA-DL.png']
const MED_CARD_FILES = ['Medical-Card.heic', 'Medical-Card.jpeg', 'Medical-Card.png']
const DEFAULT_TARGET = 'https://thelist-dev.710labs.com'
const DEFAULT_UPLOAD_SUCCESS_TIMEOUT_MS = 15000
const DEFAULT_RATE_LIMIT_UPLOAD_ATTEMPTS = 70
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 300
const DEFAULT_RATE_LIMIT_ERROR_TIMEOUT_MS = 1500
const DEFAULT_ASSERT_RATE_LIMIT = true

const DL_INPUT_SELECTOR = 'input[name="svntn_core_personal_doc"]'
const DL_SUCCESS_BADGE_SELECTOR =
	'div.eligibilityInput:has(input#svntn_core_personal_doc) span.unsealLabel.unsealSuccess.wcse-reactive--plabel'
const MED_CARD_INPUT_SELECTOR = 'input[name="svntn_core_medical_doc"]'
const MED_CARD_SUCCESS_BADGE_SELECTOR =
	'div.eligibilityInput:has(input#svntn_core_medical_doc) span.unsealLabel.unsealSuccess.wcse-reactive--plabel'
const RATE_LIMIT_ERROR_SELECTOR = 'p.eligibilityError'
const RATE_LIMIT_ERROR_TEXT = 'You are uploading too fast for me. Give it 1 minute and try again.'

function randomFirstName() {
	const firstNames = [
		'LoadTest_James',
		'LoadTest_John',
		'LoadTest_Robert',
		'LoadTest_Michael',
		'LoadTest_William',
		'LoadTest_David',
		'LoadTest_Richard',
		'LoadTest_Joseph',
		'LoadTest_Charles',
		'LoadTest_Thomas',
		'LoadTest_Christopher',
		'LoadTest_Daniel',
		'LoadTest_Matthew',
		'LoadTest_Anthony',
		'LoadTest_Donald',
		'LoadTest_Mark',
		'LoadTest_Paul',
		'LoadTest_Steven',
		'LoadTest_Andrew',
		'LoadTest_Kenneth',
		'LoadTest_Joshua',
		'LoadTest_Kevin',
		'LoadTest_Brian',
		'LoadTest_George',
		'LoadTest_Edward',
		'LoadTest_Ronald',
		'LoadTest_Timothy',
		'LoadTest_Jason',
		'LoadTest_Jeffrey',
		'LoadTest_Ryan',
		'LoadTest_Lisa',
		'LoadTest_Mary',
		'LoadTest_Karen',
		'LoadTest_Patricia',
		'LoadTest_Sandra',
		'LoadTest_Kimberly',
		'LoadTest_Donna',
		'LoadTest_Michelle',
		'LoadTest_Elizabeth',
		'LoadTest_Susan',
		'LoadTest_Jessica',
		'LoadTest_Sarah',
		'LoadTest_Nancy',
		'LoadTest_Jennifer',
		'LoadTest_Maria',
		'LoadTest_Melissa',
		'LoadTest_Emily',
		'LoadTest_Amanda',
		'LoadTest_Hannah',
		'LoadTest_Ashley',
	]

	return firstNames[Math.floor(Math.random() * firstNames.length)]
}

function randomLastName() {
	const lastNames = [
		'LoadTest_Smith',
		'LoadTest_Johnson',
		'LoadTest_Williams',
		'LoadTest_Brown',
		'LoadTest_Jones',
		'LoadTest_Garcia',
		'LoadTest_Miller',
		'LoadTest_Davis',
		'LoadTest_Rodriguez',
		'LoadTest_Martinez',
		'LoadTest_Hernandez',
		'LoadTest_Lopez',
		'LoadTest_Gonzalez',
		'LoadTest_Wilson',
		'LoadTest_Anderson',
		'LoadTest_Thomas',
		'LoadTest_Taylor',
		'LoadTest_Moore',
		'LoadTest_Jackson',
		'LoadTest_Martin',
		'LoadTest_Lee',
		'LoadTest_Perez',
		'LoadTest_Thompson',
		'LoadTest_White',
		'LoadTest_Harris',
		'LoadTest_Sanchez',
		'LoadTest_Clark',
		'LoadTest_Ramirez',
		'LoadTest_Lewis',
		'LoadTest_Robinson',
		'LoadTest_Walker',
		'LoadTest_Young',
		'LoadTest_Allen',
		'LoadTest_King',
		'LoadTest_Wright',
		'LoadTest_Scott',
		'LoadTest_Torres',
		'LoadTest_Nguyen',
		'LoadTest_Hill',
		'LoadTest_Flores',
		'LoadTest_Green',
		'LoadTest_Adams',
		'LoadTest_Nelson',
		'LoadTest_Baker',
		'LoadTest_Hall',
		'LoadTest_Rivera',
		'LoadTest_Campbell',
		'LoadTest_Mitchell',
		'LoadTest_Carter',
		'LoadTest_Roberts',
	]

	return lastNames[Math.floor(Math.random() * lastNames.length)]
}

function randomNumber() {
	return Math.floor(Math.random() * 900000) + 100000
}

function randomPhoneNumber() {
	const areaCode = '555'
	const middlePart = Math.floor(Math.random() * 1000)
		.toString()
		.padStart(3, '0')
	const lastPart = Math.floor(Math.random() * 10000)
		.toString()
		.padStart(4, '0')
	return `${areaCode}-${middlePart}-${lastPart}`
}

function parsePositiveInt(rawValue, fallback) {
	const parsed = Number.parseInt(rawValue, 10)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(rawValue, fallback) {
	if (rawValue === undefined || rawValue === null || rawValue === '') {
		return fallback
	}

	switch (String(rawValue).trim().toLowerCase()) {
		case '1':
		case 'true':
		case 'yes':
		case 'on':
			return true
		case '0':
		case 'false':
		case 'no':
		case 'off':
			return false
		default:
			return fallback
	}
}

function getTarget(vuContext) {
	return vuContext.vars.target || process.env.ARTILLERY_TARGET || DEFAULT_TARGET
}

function getUploadSuccessTimeoutMs() {
	return parsePositiveInt(
		process.env.ARTILLERY_UPLOAD_SUCCESS_TIMEOUT_MS,
		DEFAULT_UPLOAD_SUCCESS_TIMEOUT_MS,
	)
}

function getRateLimitErrorTimeoutMs() {
	return parsePositiveInt(
		process.env.ARTILLERY_RATE_LIMIT_ERROR_TIMEOUT_MS || process.env.ARTILLERY_UPLOAD_SUCCESS_TIMEOUT_MS,
		DEFAULT_RATE_LIMIT_ERROR_TIMEOUT_MS,
	)
}

function shouldAssertRateLimit() {
	return parseBoolean(process.env.ARTILLERY_ASSERT_RATE_LIMIT, DEFAULT_ASSERT_RATE_LIMIT)
}

function createUserProfile() {
	const firstName = randomFirstName()
	const lastName = randomLastName()

	return {
		firstName,
		lastName,
		email: `loadtest-${firstName.toLowerCase()}.${lastName.toLowerCase()}.${randomNumber()}@loadtest.com`,
		password: `Upload-${randomNumber()}-Pass!`,
		address: '3377 S La Cienega Blvd, Los Angeles, CA 90016',
		phoneNumber: randomPhoneNumber(),
	}
}

function getSuccessBadge(page, successSelector) {
	return page.locator(successSelector).filter({ hasText: 'On file' })
}

function getRateLimitError(page) {
	return page.locator(RATE_LIMIT_ERROR_SELECTOR).filter({ hasText: RATE_LIMIT_ERROR_TEXT })
}

async function addVipCookie(page, target) {
	await page.context().addCookies([
		{
			name: 'vipChecker',
			value: '3',
			domain: new URL(target).hostname,
			path: '/',
		},
	])
}

async function waitForInputFilename(page, inputSelector, expectedFilename) {
	await page.waitForFunction(
		({ selector, filename }) => {
			const input = document.querySelector(selector)
			if (!(input instanceof HTMLInputElement) || !input.files?.length) {
				return false
			}

			return Array.from(input.files).some(file => file.name === filename)
		},
		{ selector: inputSelector, filename: expectedFilename },
	)
}

async function clearUploadField(page, inputSelector) {
	const fileInput = page.locator(inputSelector)
	await fileInput.waitFor({ state: 'attached' })
	await fileInput.setInputFiles([])

	await page.evaluate(selector => {
		const input = document.querySelector(selector)
		if (!(input instanceof HTMLInputElement)) {
			return
		}

		input.dispatchEvent(new Event('input', { bubbles: true }))
		input.dispatchEvent(new Event('change', { bubbles: true }))
	}, inputSelector)

	await page.waitForFunction(selector => {
		const input = document.querySelector(selector)
		return input instanceof HTMLInputElement && (!input.files || input.files.length === 0)
	}, inputSelector)
}

async function waitForVisible(locator, timeoutMs) {
	try {
		await locator.waitFor({ state: 'visible', timeout: timeoutMs })
		return true
	} catch (error) {
		if (error.name === 'TimeoutError') {
			return false
		}

		throw error
	}
}

async function attemptUpload(page, inputSelector, successSelector, filename, timeouts = {}) {
	const successTimeoutMs = timeouts.successTimeoutMs || DEFAULT_UPLOAD_SUCCESS_TIMEOUT_MS
	const fileInput = page.locator(inputSelector)
	const successBadge = getSuccessBadge(page, successSelector)
	const resolvedFilePath = path.resolve(__dirname, filename)
	const startedAt = Date.now()

	await fileInput.waitFor({ state: 'attached' })
	await fileInput.setInputFiles(resolvedFilePath)
	await waitForInputFilename(page, inputSelector, filename)

	try {
		await successBadge.waitFor({ state: 'visible', timeout: successTimeoutMs })

		return {
			success: true,
			elapsedMs: Date.now() - startedAt,
			filename,
		}
	} catch (error) {
		if (error.name === 'TimeoutError') {
			return {
				success: false,
				elapsedMs: Date.now() - startedAt,
				filename,
				errorMessage: error.message,
			}
		}

		throw error
	}
}

async function attemptDlUpload(page, filename, timeouts = {}) {
	return attemptUpload(page, DL_INPUT_SELECTOR, DL_SUCCESS_BADGE_SELECTOR, filename, timeouts)
}

async function attemptDlRateLimitUpload(page, filename, timeouts = {}) {
	const rateLimitErrorTimeoutMs =
		timeouts.rateLimitErrorTimeoutMs || DEFAULT_RATE_LIMIT_ERROR_TIMEOUT_MS
	const fileInput = page.locator(DL_INPUT_SELECTOR)
	const successBadge = getSuccessBadge(page, DL_SUCCESS_BADGE_SELECTOR)
	const rateLimitError = getRateLimitError(page)
	const resolvedFilePath = path.resolve(__dirname, filename)
	const startedAt = Date.now()

	await fileInput.waitFor({ state: 'attached' })
	await fileInput.setInputFiles(resolvedFilePath)
	await waitForInputFilename(page, DL_INPUT_SELECTOR, filename)

	const rateLimitErrorVisible = await waitForVisible(rateLimitError, rateLimitErrorTimeoutMs)
	const onFileVisible = await successBadge.isVisible()

	return {
		status: rateLimitErrorVisible ? 'blocked' : 'not_blocked',
		elapsedMs: Date.now() - startedAt,
		filename,
		onFileVisible,
		rateLimitErrorVisible,
		errorMessage: null,
	}
}

async function uploadFilesSequentially(page, step, inputSelector, successSelector, filenames, stepLabelPrefix) {
	const successTimeoutMs = getUploadSuccessTimeoutMs()

	for (const filename of filenames) {
		await step(`${stepLabelPrefix}: ${filename}`, async () => {
			const result = await attemptUpload(page, inputSelector, successSelector, filename, {
				successTimeoutMs,
			})

			if (!result.success) {
				throw new Error(
					`${stepLabelPrefix} failed for ${filename}: ${result.errorMessage || 'missing success badge'}`,
				)
			}

			await page.waitForTimeout(1000)
		})
	}
}

async function reachUploadStep(page, vuContext, test) {
	const { step } = test
	const user = createUserProfile()
	const target = getTarget(vuContext)

	await addVipCookie(page, target)

	await step('Pass Age Gate', async () => {
		console.log(`[DEBUG] Starting Age Gate. URL: ${page.url()}, Title: ${await page.title()}`)
		await step('Load 710 Labs ', async () => {
			await page.goto(target)
			console.log(`[DEBUG] Page Loaded. URL: ${page.url()}, Title: ${await page.title()}`)
		})

		await step('Click Age Gate Acceptance', async () => {
			await page
				.getByRole('button', { name: "I'm over 21 or a qualified patient" })
				.click({ timeout: 60000 })
		})
	})

	await step('Enter List Password', async () => {
		console.log(`[DEBUG] Entering List Password. URL: ${page.url()}`)
		await step('Type and Submit List Password', async () => {
			const passwordField = page.locator('input[name="post_password"]')
			await passwordField.click()
			await passwordField.fill(process.env.ARTILLERY_LIST_PASSWORD)
			await page.click('text=enter site')
			console.log(`[DEBUG] Password Submitted. URL: ${page.url()}`)
		})
	})

	await step('Create Account ', async () => {
		console.log(`[DEBUG] Starting Account Creation. URL: ${page.url()}`)
		await step('Enter Account Info', async () => {
			await step('Click Register Link', async () => {
				await page.click('text=create an account')
				console.log(`[DEBUG] On Registration Page. URL: ${page.url()}`)
			})

			await step('Enter First Name', async () => {
				const firstName = page.locator('input[name="svntn_core_registration_firstname"]')
				await firstName.click()
				await firstName.fill(user.firstName)
			})

			await step('Enter Last Name', async () => {
				const lastName = page.locator('input[name="svntn_core_registration_lastname"]')
				await lastName.click()
				await lastName.fill(user.lastName)
			})

			await step('Enter Email', async () => {
				const emailField = page.locator('input[name="email"]')
				await emailField.click()
				await emailField.fill(user.email)
			})

			await step('Enter Password', async () => {
				const passwordField = page.locator('input[name="password"]')
				await passwordField.click()
				await passwordField.fill(user.password)
			})

			await step('Enter Birthdate', async () => {
				const birthMonth = page.locator('select[name="svntn_core_dob_month"]')
				const birthDay = page.locator('select[name="svntn_core_dob_day"]')
				const birthYear = page.locator('select[name="svntn_core_dob_year"]')
				await birthMonth.selectOption('12')
				await birthDay.selectOption('16')
				await birthYear.selectOption('1988')
			})

			await step('Enter Billing Address', async () => {
				const address = page.locator('input[name="billing_address_1"]')
				await address.click()
				await address.fill(user.address)
				await page.waitForTimeout(1000)
				await page.keyboard.press('ArrowDown')
				await page.keyboard.press('Enter')
			})

			await step('Enter Phone Number', async () => {
				const phoneNumber = page.locator('input[name="billing_phone"]')
				await phoneNumber.click()
				await phoneNumber.fill(user.phoneNumber)
			})

			await step('Submit New Customer Form', async () => {
				await page.waitForTimeout(2000)
				await page.click('button:has-text("Next")')
				await page.waitForTimeout(1000)
			})
		})
	})

	return { target, user }
}

async function TheListImageUploads(page, vuContext, events, test) {
	const { step } = test

	await reachUploadStep(page, vuContext, test)

	await step('Enter Validation Info', async () => {
		await step('Submit Drivers License', async () => {
			await step('Upload DL Files', async () => {
				await uploadFilesSequentially(
					page,
					step,
					DL_INPUT_SELECTOR,
					DL_SUCCESS_BADGE_SELECTOR,
					DRIVER_LICENSE_FILES,
					'Upload DL File',
				)
			})
			await step('Enter DL Exp', async () => {
				const driversLicenseExpMonth = await page.waitForSelector(
					'select[name="svntn_core_pxp_month"]',
				)
				const driversLicenseExpDay = await page.waitForSelector(
					'select[name="svntn_core_pxp_day"]',
				)
				const driversLicenseExpYear = await page.waitForSelector(
					'select[name="svntn_core_pxp_year"]',
				)

				await driversLicenseExpMonth.selectOption('12')
				await driversLicenseExpDay.selectOption('16')
				await driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
			})
		})

		// await step('Submit Med Card', async () => {
		// 	await step('Select Usage Type Medical', async () => {
		// 		await page.getByLabel('Medical', { exact: true }).check()
		// 	})
		// 	await step('Upload Med Card Files', async () => {
		// 		await uploadFilesSequentially(
		// 			page,
		// 			step,
		// 			MED_CARD_INPUT_SELECTOR,
		// 			MED_CARD_SUCCESS_BADGE_SELECTOR,
		// 			MED_CARD_FILES,
		// 			'Upload Med Card File',
		// 		)
		// 	})
		// 	await step('Enter Medical Card Exp', async () => {
		// 		const medicalCardExpMonth = await page.waitForSelector(
		// 			'select[name="svntn_core_mxp_month"]',
		// 		)
		// 		const medicalCardExpDay = await page.waitForSelector(
		// 			'select[name="svntn_core_mxp_day"]',
		// 		)
		// 		const medicalCardExpYear = await page.waitForSelector(
		// 			'select[name="svntn_core_mxp_year"]',
		// 		)
		//
		// 		await medicalCardExpMonth.selectOption('12')
		// 		await medicalCardExpDay.selectOption('16')
		// 		await medicalCardExpYear.selectOption(`${new Date().getFullYear() + 1}`)
		// 	})
		// 	await step('Add Medical Card Number', async () => {
		// 		const medicalCardNumber = page.locator('input[name="svntn_mno"]')
		// 		await medicalCardNumber.click()
		// 		await medicalCardNumber.fill('123456789')
		// 	})
		// })

		await step('Submit Validation Info', async () => {
			await page.getByRole('button', { name: 'Register' }).click()
			await page.waitForTimeout(5000)
		})
	})
}

async function TheListImageUploadRateLimit(page, vuContext, events, test) {
	const { step } = test
	const uploadAttempts = parsePositiveInt(
		process.env.ARTILLERY_UPLOAD_ATTEMPTS,
		DEFAULT_RATE_LIMIT_UPLOAD_ATTEMPTS,
	)
	const windowSeconds = parsePositiveInt(
		process.env.ARTILLERY_WINDOW_SECONDS,
		DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
	)
	const rateLimitErrorTimeoutMs = getRateLimitErrorTimeoutMs()
	const assertRateLimit = shouldAssertRateLimit()
	const windowMs = windowSeconds * 1000
	const spacingMs = windowMs / uploadAttempts

	await reachUploadStep(page, vuContext, test)
	const loopStartedAt = Date.now()

	let notBlockedAttempts = 0
	let blockedAttempts = 0
	let onFileVisibleAttempts = 0
	let firstBlockedAttempt = null
	let firstBlockedElapsedMs = null

	await step('Run DL Upload Rate Limit Loop', async () => {
		for (let attemptIndex = 0; attemptIndex < uploadAttempts; attemptIndex += 1) {
			const attemptNumber = attemptIndex + 1
			const scheduledAt = loopStartedAt + Math.round(attemptIndex * spacingMs)
			const waitMs = scheduledAt - Date.now()
			const filename = DRIVER_LICENSE_FILES[attemptIndex % DRIVER_LICENSE_FILES.length]

			if (waitMs > 0) {
				await page.waitForTimeout(waitMs)
			}

			await clearUploadField(page, DL_INPUT_SELECTOR)
			const result = await attemptDlRateLimitUpload(page, filename, {
				rateLimitErrorTimeoutMs,
			})
			const elapsedSinceLoopStartMs = Date.now() - loopStartedAt
			const driftMs = Date.now() - scheduledAt

			if (result.onFileVisible) {
				onFileVisibleAttempts += 1
			}

			if (result.status === 'blocked') {
				blockedAttempts += 1
				if (firstBlockedAttempt === null) {
					firstBlockedAttempt = attemptNumber
					firstBlockedElapsedMs = elapsedSinceLoopStartMs
				}
			} else {
				notBlockedAttempts += 1
			}

			console.log(
				`[RATE_LIMIT_ATTEMPT] ${JSON.stringify({
					attemptNumber,
					filename,
					status: result.status,
					elapsedMs: result.elapsedMs,
					elapsedSinceLoopStartMs,
					driftMs,
					onFileVisible: result.onFileVisible,
					rateLimitErrorVisible: result.rateLimitErrorVisible,
					errorMessage: result.errorMessage,
				})}`,
			)
		}
	})

	const summary = {
		totalAttemptsPlanned: uploadAttempts,
		totalAttemptsExecuted: notBlockedAttempts + blockedAttempts,
		notBlockedAttempts,
		blockedAttempts,
		onFileVisibleAttempts,
		firstBlockedAttempt,
		firstBlockedElapsedMs,
		windowSeconds,
		spacingMs,
		rateLimitErrorTimeoutMs,
		assertRateLimit,
	}

	console.log(`[RATE_LIMIT_SUMMARY] ${JSON.stringify(summary)}`)

	if (assertRateLimit && firstBlockedAttempt === null) {
		throw new Error(
			`Image upload rate limit did not trip within ${uploadAttempts} attempts over ${windowSeconds} seconds`,
		)
	}
}

module.exports = {
	TheListImageUploads,
	TheListImageUploadRateLimit,
}
