const path = require('path')
const { addQaCookies } = require('./qa-cookies')
const { DRIVER_LICENSE_FILES } = require('./image-upload-fixtures')

const DEFAULT_TARGET = 'https://live-dev.710labs.com'
const LIVE_AUTHENTICATION_ADDRESS = '440 Rodeo Drive Beverly Hills'
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_UPLOAD_ATTEMPTS = 70
const DEFAULT_WINDOW_SECONDS = 300
const DEFAULT_ASSERT_RATE_LIMIT = false
const ADMIN_AJAX_PATH = '/wp-admin/admin-ajax.php'
const PRODUCT_SELECTOR = 'li.product.type-product'
const AUTH_MODAL_SELECTOR = 'section.wpse-component #renderGateway'
const ACCOUNT_LINK_SELECTOR = 'a[href*="/my-account"]'
const PHOTO_ID_EDIT_LINK_SELECTOR = 'a.specific-link[data-module="iddoc"]'
const PHOTO_ID_DRAWER_SELECTOR = '.wpse-drawer:has(h2:has-text("Replace your ID on file"))'
const PHOTO_ID_INPUT_SELECTOR = 'input#fasd_doc'
const PHOTO_ID_EXPIRATION_SELECTOR = 'input#doc_exp'
const LIVE_RATE_LIMIT_PATTERN =
	/upload(?:ing)?\s+too\s+fast|too\s+many\s+(?:uploads|requests)|rate[-\s]?limit|try\s+again\s+(?:in|after)/i
const CART_DRAWER_SELECTOR = [
	'.wpse-drawer[data-module="cart"]',
	'.wpse-drawer[data-module="cart-response"]',
].join(', ')
const ERROR_TEXT_SELECTOR = [
	'p[id$="_error"]',
	'.fasd-form-error',
	'.eligibilityError',
	'[role="alert"]',
].join(', ')

function parsePositiveInt(value, fallback) {
	const parsed = Number.parseInt(value, 10)

	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(value, fallback) {
	if (value === undefined || value === null || value === '') {
		return fallback
	}

	switch (String(value).trim().toLowerCase()) {
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

function getLivePassword() {
	const password = process.env.ARTILLERY_LIVE_PASSWORD

	if (!password?.trim()) {
		throw new Error('ARTILLERY_LIVE_PASSWORD is required for Live image upload rate-limit runs')
	}

	return password
}

function createLiveUser() {
	const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
	const nameSuffix = uniqueSuffix.replace(/[^a-zA-Z0-9]/g, '').slice(-12)

	return {
		dob: '1985-01-02',
		email: `test_710_live_upload_limit_${uniqueSuffix}@test.com`,
		firstName: `RateLimit${nameSuffix}`,
		lastName: `ImageUpload${nameSuffix}`,
		password: getLivePassword(),
		zip: '90232',
	}
}

async function elementIntersectsViewport(locator) {
	if ((await locator.count()) === 0) {
		return false
	}

	return locator
		.evaluate(element => {
			const rect = element.getBoundingClientRect()
			const style = getComputedStyle(element)

			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				rect.width > 0 &&
				rect.height > 0 &&
				rect.left < window.innerWidth &&
				rect.right > 0 &&
				rect.top < window.innerHeight &&
				rect.bottom > 0
			)
		})
		.catch(() => false)
}

async function getVisibleLocator(locator) {
	const count = await locator.count()

	for (let index = 0; index < count; index += 1) {
		const candidate = locator.nth(index)

		if (await elementIntersectsViewport(candidate)) {
			return candidate
		}
	}

	return null
}

async function waitForVisibleLocator(locator, timeoutMs = DEFAULT_TIMEOUT_MS) {
	const deadline = Date.now() + timeoutMs

	while (Date.now() < deadline) {
		const visibleLocator = await getVisibleLocator(locator)

		if (visibleLocator) {
			return visibleLocator
		}

		await locator.first().waitFor({ state: 'attached', timeout: 500 }).catch(() => {})
		await new Promise(resolve => setTimeout(resolve, 100))
	}

	throw new Error(`No visible element matched ${locator}`)
}

async function clickVisible(locator, timeoutMs = DEFAULT_TIMEOUT_MS) {
	const visibleLocator = await waitForVisibleLocator(locator, timeoutMs)
	await visibleLocator.evaluate(element => element.click())
	return visibleLocator
}

async function enterLiveAddress(page) {
	await clickVisible(page.locator('a.wpse-button-storenav.wpse-openerize'))

	const addressDrawer = await waitForVisibleLocator(
		page.locator('div.wpse-drawer[data-module="fulfillment"]'),
	)
	let addressInput = addressDrawer.locator('#fasd_address')

	if (!(await elementIntersectsViewport(addressInput))) {
		await clickVisible(addressDrawer.locator('label:has-text("Add new address")'))
		addressInput = addressDrawer.locator('#fasd_address')
		await waitForVisibleLocator(addressInput, 5000)
	}

	await addressInput.fill(LIVE_AUTHENTICATION_ADDRESS)
	await page.locator('.pac-item').first().waitFor({ state: 'visible', timeout: 10000 })
	await addressInput.press('ArrowDown')
	await addressInput.press('Enter')

	const submitButton = addressDrawer
		.locator('button.wpse-button-primary.fasd-form-submit')
		.first()
	await submitButton.waitFor({ state: 'visible' })
	await submitButton.click()
	await page.waitForLoadState('domcontentloaded').catch(() => {})
	await page.locator(PRODUCT_SELECTOR).first().waitFor({ state: 'visible', timeout: 20000 })
}

async function addNonMedicalProduct(page) {
	const products = page.locator(PRODUCT_SELECTOR)
	await products.first().waitFor({ state: 'visible', timeout: 15000 })
	await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

	const productCount = await products.count()

	for (let index = 0; index < productCount; index += 1) {
		const product = products.nth(index)
		const isMedicalOnly =
			(await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

		if (isMedicalOnly) {
			continue
		}

		const productLink = product
			.locator('.woocommerce-loop-product__link, img.wp-post-image, img')
			.first()

		await productLink.waitFor({ state: 'visible' })
		await productLink.click()
		await page.waitForLoadState('domcontentloaded').catch(() => {})

		const addToCartButton = page.getByRole('button', { name: /add to cart/i }).first()
		await addToCartButton.waitFor({ state: 'visible', timeout: 15000 })
		await addToCartButton.click({ force: true })
		await page.locator(AUTH_MODAL_SELECTOR).waitFor({ state: 'visible', timeout: 15000 })
		return
	}

	throw new Error(`No non-medical product was available among ${productCount} Live products`)
}

async function registerLiveUser(page, user) {
	const authModal = page.locator(AUTH_MODAL_SELECTOR)
	await authModal.waitFor({ state: 'visible' })

	await authModal.locator('#fasd_email').fill(user.email)
	await authModal.locator('button:has-text("Continue")').click()

	const passwordInput = authModal.locator('input.fasd-form-value#password')
	await passwordInput.waitFor({ state: 'visible' })
	await passwordInput.fill(user.password)
	await authModal.locator('input.fasd-form-value#reg_fname').fill(user.firstName)
	await authModal.locator('input.fasd-form-value#reg_lname').fill(user.lastName)

	const zipInput = authModal.locator('input.fasd-form-value#reg_postcode')
	if (await zipInput.isVisible().catch(() => false)) {
		await zipInput.fill(user.zip)
	}

	await authModal.locator('input.fasd-form-value#reg_dob').fill(user.dob)
	await authModal.locator('button:has-text("Create Account")').click()
	await authModal.waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT_MS })
}

async function dismissStorefrontOverlays(page) {
	const cartDrawer = await getVisibleLocator(page.locator(CART_DRAWER_SELECTOR))

	if (cartDrawer) {
		const closeButton = cartDrawer
			.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
			.first()

		if ((await closeButton.count()) > 0) {
			await closeButton.evaluate(element => element.click())
			await cartDrawer.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
		}
	}

	const scrim = await getVisibleLocator(page.locator('.wpse-scrim-front'))
	if (scrim) {
		await scrim.evaluate(element => element.click())
		await page.waitForTimeout(300)
	}
}

async function goToAccountPage(page, target) {
	await dismissStorefrontOverlays(page)

	const signOutLink = page.getByRole('link', { name: 'Sign out', exact: true })
	if (!(await signOutLink.isVisible().catch(() => false))) {
		const accountLink = await getVisibleLocator(page.locator(ACCOUNT_LINK_SELECTOR))

		if (accountLink) {
			const accountHref = await accountLink.getAttribute('href')
			await accountLink.evaluate(element => element.click())

			const accountPageLoaded = await signOutLink
				.waitFor({ state: 'visible', timeout: 10000 })
				.then(() => true)
				.catch(() => false)

			if (!accountPageLoaded && accountHref) {
				await page.goto(new URL(accountHref, page.url()).toString())
			}
		} else {
			await page.goto(new URL('/my-account/', target).toString())
		}
	}

	await page.waitForLoadState('domcontentloaded').catch(() => {})
	await signOutLink.waitFor({ state: 'visible', timeout: 15000 })
	await page.locator('h3:has-text("Photo ID")').waitFor({ state: 'visible' })
}

async function waitForSelectedFilename(fileInput, filename) {
	await fileInput.evaluate(
		(input, expectedFilename) => {
			if (!(input instanceof HTMLInputElement)) {
				throw new Error('Expected a file input')
			}

			if (!Array.from(input.files || []).some(file => file.name === expectedFilename)) {
				throw new Error(`Selected files did not include ${expectedFilename}`)
			}
		},
		filename,
	)
}

function waitForDocumentUpdateResponse(page) {
	return page.waitForResponse(
		response =>
			response.request().method() === 'POST' && response.url().includes(ADMIN_AJAX_PATH),
		{ timeout: DEFAULT_TIMEOUT_MS },
	)
}

function hasPayloadErrors(payload) {
	if (!payload || payload.errors === undefined || payload.errors === null) {
		return false
	}

	if (Array.isArray(payload.errors)) {
		return payload.errors.length > 0
	}

	if (typeof payload.errors === 'object') {
		return Object.keys(payload.errors).length > 0
	}

	return String(payload.errors).trim().length > 0
}

function isSuccessfulPayload(payload) {
	return Boolean(
		payload &&
			!hasPayloadErrors(payload) &&
			(payload.outcome === 'success' ||
				payload.successCloserize === true ||
				payload.success === true),
	)
}

function summarizePayload(payload) {
	if (!payload || typeof payload !== 'object') {
		return null
	}

	return {
		errors:
			payload.errors === undefined || payload.errors === null
				? null
				: normalizeText(JSON.stringify(payload.errors)),
		message: payload.message === undefined ? null : normalizeText(payload.message),
		outcome: payload.outcome === undefined ? null : normalizeText(payload.outcome),
		success: payload.success ?? null,
		successCloserize: payload.successCloserize ?? null,
	}
}

function normalizeText(value) {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 1000)
}

function classifyLiveDocumentResponse({ httpStatus, payload, bodyPreview, uiErrorText }) {
	const evidenceText = normalizeText(
		JSON.stringify({
			bodyPreview,
			errors: payload?.errors,
			message: payload?.message,
			uiErrorText,
		}),
	)

	if (httpStatus === 429 || LIVE_RATE_LIMIT_PATTERN.test(evidenceText)) {
		return 'rate_limited'
	}

	if (httpStatus >= 200 && httpStatus < 300 && isSuccessfulPayload(payload)) {
		return 'accepted'
	}

	return 'unexpected_error'
}

async function readResponseBody(response) {
	const responseText = await response.text().catch(() => '')
	let payload = null

	if (responseText) {
		try {
			payload = JSON.parse(responseText)
		} catch {
			payload = null
		}
	}

	return {
		bodyPreview: payload ? '' : normalizeText(responseText),
		payload,
	}
}

async function collectVisibleErrorText(page, drawer) {
	await page.waitForTimeout(250)
	const errors = drawer.locator(ERROR_TEXT_SELECTOR)
	const texts = []

	for (let index = 0; index < (await errors.count()); index += 1) {
		const error = errors.nth(index)

		if (await error.isVisible().catch(() => false)) {
			const text = normalizeText(await error.textContent().catch(() => ''))

			if (text) {
				texts.push(text)
			}
		}
	}

	return normalizeText(texts.join(' | '))
}

async function recoverOpenPhotoIdDrawer(page) {
	const drawer = await getVisibleLocator(page.locator(PHOTO_ID_DRAWER_SELECTOR))

	if (!drawer) {
		return
	}

	await page.reload({ waitUntil: 'domcontentloaded' })
	await page.locator('h3:has-text("Photo ID")').waitFor({ state: 'visible', timeout: 15000 })
}

async function attemptLivePhotoIdUpload(page, filename, expirationDay) {
	await recoverOpenPhotoIdDrawer(page)
	await clickVisible(page.locator(PHOTO_ID_EDIT_LINK_SELECTOR))

	const drawer = await waitForVisibleLocator(page.locator(PHOTO_ID_DRAWER_SELECTOR))
	const fileInput = drawer.locator(PHOTO_ID_INPUT_SELECTOR)
	const expirationInput = drawer.locator(PHOTO_ID_EXPIRATION_SELECTOR)
	const resolvedFilePath = path.resolve(__dirname, filename)
	const expirationYear = new Date().getFullYear() + 1
	const day = String(expirationDay).padStart(2, '0')
	const startedAt = Date.now()

	await fileInput.waitFor({ state: 'attached' })
	await fileInput.setInputFiles(resolvedFilePath)
	await waitForSelectedFilename(fileInput, filename)
	await expirationInput.fill(`${expirationYear}-04-${day}`)

	const responsePromise = waitForDocumentUpdateResponse(page)
	const saveButton = drawer.locator('.fasd-form-submit').first()
	await saveButton.waitFor({ state: 'visible' })
	await saveButton.evaluate(element => element.click())

	const response = await responsePromise
	const { bodyPreview, payload } = await readResponseBody(response)
	const uiErrorText = await collectVisibleErrorText(page, drawer)
	const httpStatus = response.status()
	const status = classifyLiveDocumentResponse({
		bodyPreview,
		httpStatus,
		payload,
		uiErrorText,
	})

	if (status === 'accepted') {
		await drawer.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
	}

	return {
		bodyPreview,
		elapsedMs: Date.now() - startedAt,
		filename,
		httpStatus,
		payload: summarizePayload(payload),
		status,
		uiErrorText,
	}
}

async function LiveImageUploadRateLimit(page, vuContext, events, test) {
	const { step } = test
	const target = getTarget(vuContext)
	const user = createLiveUser()
	const uploadAttempts = parsePositiveInt(
		process.env.ARTILLERY_UPLOAD_ATTEMPTS,
		DEFAULT_UPLOAD_ATTEMPTS,
	)
	const windowSeconds = parsePositiveInt(
		process.env.ARTILLERY_WINDOW_SECONDS,
		DEFAULT_WINDOW_SECONDS,
	)
	const assertRateLimit = parseBoolean(
		process.env.ARTILLERY_ASSERT_RATE_LIMIT,
		DEFAULT_ASSERT_RATE_LIMIT,
	)
	const spacingMs = (windowSeconds * 1000) / uploadAttempts

	await addQaCookies(page, target)

	await step('Live: Select Store and Reach Registration', async () => {
		await page.goto(target)
		await page.locator('span.site-header-group').waitFor({ state: 'visible', timeout: 20000 })
		await enterLiveAddress(page)
		await addNonMedicalProduct(page)
	})

	await step('Live: Register Test Account', async () => {
		await registerLiveUser(page, user)
	})

	await step('Live: Open My Account', async () => {
		await goToAccountPage(page, target)
	})

	const loopStartedAt = Date.now()
	let acceptedAttempts = 0
	let rateLimitedAttempts = 0
	let unexpectedErrorAttempts = 0
	let firstRateLimitedAttempt = null
	let firstRateLimitedElapsedMs = null

	await step('Live: Run Photo ID Upload Rate Limit Loop', async () => {
		for (let attemptIndex = 0; attemptIndex < uploadAttempts; attemptIndex += 1) {
			const attemptNumber = attemptIndex + 1
			const scheduledAt = loopStartedAt + Math.round(attemptIndex * spacingMs)
			const waitMs = scheduledAt - Date.now()
			const filename = DRIVER_LICENSE_FILES[attemptIndex % DRIVER_LICENSE_FILES.length]
			const expirationDay = 1 + (attemptIndex % 28)

			if (waitMs > 0) {
				await page.waitForTimeout(waitMs)
			}

			const result = await attemptLivePhotoIdUpload(page, filename, expirationDay)
			const elapsedSinceLoopStartMs = Date.now() - loopStartedAt

			if (events && typeof events.emit === 'function') {
				events.emit('counter', `live.image_upload.${result.status}`, 1)
				events.emit('histogram', 'live.image_upload.response_time_ms', result.elapsedMs)
			}

			if (result.status === 'accepted') {
				acceptedAttempts += 1
			} else if (result.status === 'rate_limited') {
				rateLimitedAttempts += 1

				if (firstRateLimitedAttempt === null) {
					firstRateLimitedAttempt = attemptNumber
					firstRateLimitedElapsedMs = elapsedSinceLoopStartMs
				}
			} else {
				unexpectedErrorAttempts += 1
			}

			console.log(
				`[LIVE_RATE_LIMIT_ATTEMPT] ${JSON.stringify({
					attemptNumber,
					bodyPreview: result.bodyPreview,
					driftMs: Date.now() - scheduledAt,
					elapsedMs: result.elapsedMs,
					elapsedSinceLoopStartMs,
					filename,
					httpStatus: result.httpStatus,
					payload: result.payload,
					status: result.status,
					uiErrorText: result.uiErrorText,
				})}`,
			)
		}
	})

	const summary = {
		acceptedAttempts,
		assertRateLimit,
		firstRateLimitedAttempt,
		firstRateLimitedElapsedMs,
		rateLimitedAttempts,
		spacingMs,
		totalAttemptsExecuted:
			acceptedAttempts + rateLimitedAttempts + unexpectedErrorAttempts,
		totalAttemptsPlanned: uploadAttempts,
		unexpectedErrorAttempts,
		windowSeconds,
	}

	console.log(`[LIVE_RATE_LIMIT_SUMMARY] ${JSON.stringify(summary)}`)

	if (assertRateLimit && firstRateLimitedAttempt === null) {
		throw new Error(
			`Live image upload rate limit did not trip within ${uploadAttempts} attempts over ${windowSeconds} seconds`,
		)
	}

	if (assertRateLimit && unexpectedErrorAttempts > 0) {
		throw new Error(
			`Live image upload rate-limit run returned ${unexpectedErrorAttempts} unexpected error response(s)`,
		)
	}
}

module.exports = {
	LiveImageUploadRateLimit,
	classifyLiveDocumentResponse,
	hasPayloadErrors,
	isSuccessfulPayload,
}
