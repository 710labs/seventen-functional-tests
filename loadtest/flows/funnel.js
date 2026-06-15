const fs = require('fs')
const path = require('path')

const DEFAULT_TARGET = 'https://thelist-dev.710labs.com'
const DEFAULT_CART_ITEM_COUNT = 1
const DEFAULT_QUEUE_WAIT_MS = 60 * 60 * 1000
const DEFAULT_READY_WAIT_MS = 60 * 1000
const DEFAULT_REGISTRATION_ADDRESS = '3377 S La Cienega Blvd, Los Angeles, CA 90016'
const DEFAULT_REGISTRATION_STATE = 'CA'
const DEFAULT_REGISTRATION_ZIP = '90016'
const DEFAULT_USAGE_TYPE = 'Recreational'

const VIP_CHECKER_COOKIE_NAME = 'vipChecker'
const RECAPTCHA_BYPASS_COOKIE_NAME = 'qa_wf_captcha_bypass'

const REGISTRATION_ADDRESS_SELECTOR = 'input[name="billing_address_1"]'
const BILLING_STATE_SELECTOR = 'select[name="billing_state"], input[name="billing_state"], #billing_state'
const BILLING_ZIP_SELECTOR = 'input[name="billing_postcode"], #billing_postcode'
const DL_INPUT_SELECTOR = 'input[name="svntn_core_personal_doc"]'
const DL_SUCCESS_SELECTOR = [
	'div.eligibilityInput:has(input#svntn_core_personal_doc) span.unsealLabel.unsealSuccess.wcse-reactive--plabel',
	'div.eligibilityInput:has(input[name="svntn_core_personal_doc"]) span.unsealLabel.unsealSuccess',
].join(', ')
const DL_EXPIRATION_SELECTORS = [
	'select[name="svntn_core_pxp_month"]',
	'select[name="svntn_core_pxp_day"]',
	'select[name="svntn_core_pxp_year"]',
]
const CHECKOUT_BUTTON_SELECTOR = [
	'.checkout-button',
	'a.checkout-button',
	'.wc-proceed-to-checkout .wcse-checkout-button.wcse-warning-button',
	'.wcse-checkout-button.wcse-warning-button',
	'.conditional-checkout-button',
	'button:has-text("Continue to checkout")',
	'a:has-text("Continue to checkout")',
].join(', ')
const CHECKOUT_NOTICE_SELECTOR = [
	'.woocommerce-message',
	'.woocommerce-error',
	'.woocommerce-info',
	'.wc-block-components-notice-banner',
	'.notyf__toast',
	'.wpse-snacktoast',
	'[role="alert"]',
].join(', ')
const RECREATIONAL_ADD_TO_CART_SELECTOR =
	'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test")) and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]'
const MEDICAL_ADD_TO_CART_SELECTOR =
	'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test"))]//a[contains(@aria-label, "Add to cart:")]'
const FALLBACK_ADD_TO_CART_SELECTOR = [
	'a.add_to_cart_button',
	'button.add_to_cart_button',
	'button.product_type_simple.fasd_to_cart.ajax_groove',
	'button.fasd_to_cart',
	'[data-product_sku].fasd_to_cart',
	'[data-product_sku].add_to_cart_button',
].join(', ')

const DEBUG_SCREENSHOT_DIR = path.resolve(__dirname, '../debug-screenshots')

const FIRST_NAMES = [
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

const LAST_NAMES = [
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

function isTruthy(rawValue) {
	return ['1', 'true', 'yes', 'y', 'on'].includes(String(rawValue || '').trim().toLowerCase())
}

function parsePositiveInt(rawValue, fallback) {
	const parsed = Number.parseInt(rawValue, 10)

	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeZip(value) {
	return String(value || '').replace(/\D/g, '').slice(0, 5)
}

function pick(values) {
	return values[Math.floor(Math.random() * values.length)]
}

function randomNumber() {
	return Math.floor(Math.random() * 900000) + 100000
}

function randomPhoneNumber() {
	const middlePart = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
	const lastPart = String(Math.floor(Math.random() * 10000)).padStart(4, '0')

	return `555-${middlePart}-${lastPart}`
}

function normalizeChoice(rawValue, allowedValues, fallback) {
	const requested = String(rawValue || '').trim().toLowerCase()
	const matched = allowedValues.find(value => value.toLowerCase() === requested)

	return matched || fallback
}

function getTarget(vuContext) {
	return (
		vuContext?.vars?.target ||
		process.env.ARTILLERY_TARGET ||
		process.env.TARGET ||
		DEFAULT_TARGET
	)
}

function getCartCount() {
	return parsePositiveInt(process.env.ARTILLERY_CART_ITEM_COUNT, DEFAULT_CART_ITEM_COUNT)
}

function getUsageType() {
	return normalizeChoice(
		process.env.ARTILLERY_USAGE_TYPE,
		['Recreational', 'Medical'],
		DEFAULT_USAGE_TYPE,
	)
}

function getFulfillmentType() {
	return normalizeChoice(
		process.env.ARTILLERY_FULFILLMENT_TYPE,
		['Pickup', 'Delivery'],
		Math.random() < 0.5 ? 'Pickup' : 'Delivery',
	)
}

function shouldCaptureScreenshots() {
	return isTruthy(process.env.SCREENSHOTS) || isTruthy(process.env.ARTILLERY_SCREENSHOTS)
}

function shouldPlaceOrders() {
	return isTruthy(process.env.PLACE_ORDERS) || isTruthy(process.env.ARTILLERY_PLACE_ORDERS)
}

function getStep(test) {
	return test && typeof test.step === 'function' ? test.step.bind(test) : async (name, fn) => fn()
}

function buildCookies({ vip = false, target = process.env.ARTILLERY_TARGET || DEFAULT_TARGET } = {}) {
	const targetUrl = new URL(target)
	const cookies = []

	if (vip) {
		cookies.push({
			name: VIP_CHECKER_COOKIE_NAME,
			value: process.env.VIP_COOKIE_VALUE || process.env.ARTILLERY_VIP_COOKIE_VALUE || '3',
			domain: targetUrl.hostname,
			path: '/',
		})
	}

	const recaptchaBypass = process.env.RECAPTCHA_BYPASS

	if (recaptchaBypass && recaptchaBypass.trim()) {
		cookies.push({
			name: RECAPTCHA_BYPASS_COOKIE_NAME,
			value: recaptchaBypass.trim(),
			domain: targetUrl.hostname,
			path: '/',
			httpOnly: false,
			secure: targetUrl.protocol === 'https:',
			sameSite: 'Lax',
		})
	}

	return cookies
}

function emitHistogram(events, metricName, value) {
	if (events && typeof events.emit === 'function') {
		events.emit('histogram', metricName, value)
	}
}

async function measuredStep(events, step, metricName, label, fn) {
	const startedAt = Date.now()

	return step(label, async () => {
		try {
			return await fn()
		} finally {
			emitHistogram(events, `funnel.${metricName}_ms`, Date.now() - startedAt)
		}
	})
}

async function addQaCookies(page, target, { vip }) {
	const cookies = buildCookies({ vip, target })

	if (cookies.length === 0) {
		return
	}

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

function resolveFixturePath(fileName) {
	const candidates = [
		path.resolve(__dirname, '../fixtures', fileName),
		path.resolve(process.cwd(), 'loadtest/fixtures', fileName),
		path.resolve(process.cwd(), 'fixtures', fileName),
		path.resolve(process.cwd(), fileName),
	]
	const fixturePath = candidates.find(candidate => fs.existsSync(candidate))

	if (!fixturePath) {
		throw new Error(`Could not find fixture ${fileName}. Checked: ${candidates.join(', ')}`)
	}

	return fixturePath
}

async function getBodyPreview(page) {
	const bodyText = await page.locator('body').textContent().catch(() => '')

	return (bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 1000)
}

async function captureScreenshot(page, label) {
	if (!shouldCaptureScreenshots()) {
		return undefined
	}

	fs.mkdirSync(DEBUG_SCREENSHOT_DIR, { recursive: true })

	const safeLabel = label.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
	const screenshotPath = path.join(DEBUG_SCREENSHOT_DIR, `${Date.now()}-${safeLabel}.png`)

	await page.screenshot({ path: screenshotPath, fullPage: true }).catch(error => {
		console.warn(`[screenshots] Could not capture screenshot "${label}": ${error.message}`)
	})

	return screenshotPath
}

async function waitForOptionalInputValue(page, selector, fieldName, matches) {
	const locator = page.locator(selector).first()

	if ((await locator.count()) === 0) {
		return ''
	}

	const deadline = Date.now() + 5000
	let lastValue = ''

	while (Date.now() < deadline) {
		lastValue = (await locator.inputValue().catch(() => '')).trim()

		if (matches(lastValue)) {
			return lastValue
		}

		await page.waitForTimeout(250)
	}

	throw new Error(
		[
			`Registration address ${fieldName} did not resolve after selecting autocomplete.`,
			`Last ${fieldName}: "${lastValue}"`,
			`Current URL: ${page.url()}`,
			`Address value: "${await page.locator(REGISTRATION_ADDRESS_SELECTOR).inputValue().catch(() => '')}"`,
			`Body preview: ${await getBodyPreview(page)}`,
		].join('\n'),
	)
}

async function assertResolvedAddress(page, expectedState, expectedZip) {
	const address = page.locator(REGISTRATION_ADDRESS_SELECTOR).first()
	const state = expectedState.toUpperCase()
	const zip = normalizeZip(expectedZip)
	const deadline = Date.now() + 5000
	let lastAddress = ''

	await address.waitFor({ state: 'visible', timeout: 10000 })

	while (Date.now() < deadline) {
		lastAddress = (await address.inputValue().catch(() => '')).trim()

		if (lastAddress) {
			break
		}

		await page.waitForTimeout(250)
	}

	if (!lastAddress) {
		throw new Error('Registration address was not populated.')
	}

	await waitForOptionalInputValue(
		page,
		BILLING_STATE_SELECTOR,
		'billing_state',
		value => value.trim().toUpperCase() === state,
	)

	if (zip) {
		await waitForOptionalInputValue(
			page,
			BILLING_ZIP_SELECTOR,
			'billing_postcode',
			value => normalizeZip(value) === zip,
		)
	}
}

async function selectResolvedBillingAddress(page, addressValue, expectedState, expectedZip) {
	const address = page.locator(REGISTRATION_ADDRESS_SELECTOR).first()

	await address.click()
	await address.fill('')
	await address.pressSequentially(addressValue, { delay: 25 })

	const suggestion = page.locator('.pac-item').first()
	const suggestionVisible = await suggestion
		.waitFor({ state: 'visible', timeout: 10000 })
		.then(() => true)
		.catch(() => false)

	if (suggestionVisible) {
		await suggestion.click()
	} else {
		await page.keyboard.press('ArrowDown')
		await page.keyboard.press('Enter')
	}

	await assertResolvedAddress(page, expectedState, expectedZip)
}

async function waitForLocatorEnabled(page, locator, label, timeoutMs = 10000) {
	const deadline = Date.now() + timeoutMs

	while (Date.now() < deadline) {
		const visible = await locator.isVisible().catch(() => false)
		const enabled = await locator.isEnabled().catch(() => false)

		if (visible && enabled) {
			return
		}

		await page.waitForTimeout(250)
	}

	throw new Error(`${label} should be visible and enabled before submit.`)
}

async function waitForRegistrationReadyToSubmit(page, expectedState, expectedZip) {
	const nextButton = page.getByRole('button', { name: /^next$/i })

	await page.waitForFunction(() => document.readyState !== 'loading')
	await assertResolvedAddress(page, expectedState, expectedZip)
	await nextButton.waitFor({ state: 'visible', timeout: 10000 })
	await waitForLocatorEnabled(page, nextButton, 'Registration Next button')

	return nextButton
}

function isShopRouteBeforeEligibility(page) {
	try {
		const url = new URL(page.url())

		return (
			url.pathname === '/' &&
			['', '#', '#pickup', '#pickup-deliver', '#deliver'].includes(url.hash)
		)
	} catch (error) {
		return false
	}
}

async function isEligibilityLicenseStepVisible(page) {
	const eligibilityContextVisible = await page
		.locator('#eligibilityContext')
		.first()
		.isVisible()
		.catch(() => false)
	const licenseInputVisible = await page
		.locator(DL_INPUT_SELECTOR)
		.first()
		.isVisible()
		.catch(() => false)
	const usageTypeVisible = await page
		.locator('input[name="svntn_last_usage_type"]')
		.first()
		.isVisible()
		.catch(() => false)
	const completeAccountVisible = await page
		.getByText(/complete your account/i)
		.first()
		.isVisible()
		.catch(() => false)
	const idUploadVisible = await page
		.getByText(/id upload/i)
		.first()
		.isVisible()
		.catch(() => false)

	return (
		eligibilityContextVisible ||
		licenseInputVisible ||
		usageTypeVisible ||
		completeAccountVisible ||
		idUploadVisible
	)
}

async function waitForEligibilityStep(page, target) {
	const deadline = Date.now() + 20000
	let attemptedEligibilityFallback = false

	while (Date.now() < deadline) {
		if (await isEligibilityLicenseStepVisible(page)) {
			return
		}

		if (!attemptedEligibilityFallback && isShopRouteBeforeEligibility(page)) {
			attemptedEligibilityFallback = true
			console.warn(
				'[registration] Redirected to the shop before eligibility appeared; navigating to /my-account/eligibility/.',
			)
			await page.goto(new URL('/my-account/eligibility/', target).toString(), {
				waitUntil: 'domcontentloaded',
			})
			continue
		}

		await page.waitForTimeout(250)
	}

	throw new Error(
		[
			'Eligibility/license step did not load after submitting the registration form.',
			`Current URL: ${page.url()}`,
			`Body preview: ${await getBodyPreview(page)}`,
		].join('\n'),
	)
}

async function selectRegistrationUsageType(page, usageType) {
	const label = page.getByLabel(usageType, { exact: true }).first()
	const labelVisible = await label.isVisible().catch(() => false)

	if (labelVisible) {
		try {
			await label.check()
			return
		} catch (error) {
			await label.click().catch(() => {})
		}
	}

	const textInput = page.locator(`text=${usageType} >> input[name="svntn_last_usage_type"]`).first()

	if ((await textInput.count()) > 0) {
		await textInput.click()
		return
	}

	const valueInput = page
		.locator(`input[name="svntn_last_usage_type"][value="${usageType.toLowerCase()}"]`)
		.first()

	if ((await valueInput.count()) > 0) {
		await valueInput.check()
		return
	}

	throw new Error(`Could not select ${usageType} usage type. Body preview: ${await getBodyPreview(page)}`)
}

async function waitForPersonalDocumentAccepted(page, timeoutMs = 20000) {
	const successBadge = page.locator(DL_SUCCESS_SELECTOR).first()
	const deadline = Date.now() + timeoutMs

	while (Date.now() < deadline) {
		const successVisible = await successBadge.isVisible().catch(() => false)
		const expirationEnabled = await Promise.all(
			DL_EXPIRATION_SELECTORS.map(selector =>
				page.locator(selector).first().isEnabled().catch(() => false),
			),
		)

		if (successVisible || expirationEnabled.every(Boolean)) {
			return
		}

		await page.waitForTimeout(500)
	}

	throw new Error(
		[
			'Drivers license file was selected, but the storefront did not mark the ID upload as accepted.',
			`Eligibility error text: ${(
				await page.locator('p.eligibilityError, .eligibilityError').allTextContents().catch(() => [])
			).join(' | ')}`,
			`Body preview: ${await getBodyPreview(page)}`,
		].join('\n'),
	)
}

async function uploadDriversLicense(page) {
	const fixturePath = resolveFixturePath('CA-DL.jpg')
	const dlInput = page.locator(DL_INPUT_SELECTOR).first()

	await dlInput.waitFor({ state: 'attached', timeout: 20000 })

	try {
		const [driversLicenseChooser] = await Promise.all([
			page.waitForEvent('filechooser', { timeout: 10000 }),
			dlInput.click({ timeout: 10000 }),
		])

		await page.waitForTimeout(5000)
		await driversLicenseChooser.setFiles(fixturePath)
	} catch (error) {
		await dlInput.setInputFiles(fixturePath)
	}

	await waitForPersonalDocumentAccepted(page)
}

async function getCartDebugState(page) {
	const checkoutButton = page.locator(CHECKOUT_BUTTON_SELECTOR).first()
	const cartItems = page.locator('.cart_item')
	const notices = await page.locator(CHECKOUT_NOTICE_SELECTOR).allTextContents().catch(() => [])

	return {
		url: page.url(),
		cartItemCount: await cartItems.count().catch(() => 0),
		checkoutButtonCount: await page.locator(CHECKOUT_BUTTON_SELECTOR).count().catch(() => 0),
		checkoutButtonVisible: await checkoutButton.isVisible().catch(() => false),
		checkoutButtonEnabled: await checkoutButton.isEnabled().catch(() => false),
		emptyCartVisible: await page
			.getByText(/cart is currently empty/i)
			.first()
			.isVisible()
			.catch(() => false),
		cartCountText: await page
			.locator('a.cart-contents, .cart-contents, .rsp-countdown-content')
			.first()
			.textContent()
			.catch(() => ''),
		notices: notices.map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean),
		bodyPreview: await getBodyPreview(page),
	}
}

async function getCheckoutCandidate(page) {
	const conditionalityToggle = page.locator('#conditionality').first()
	const conditionalButton = page.locator('.conditional-checkout-button').first()
	const conditionalVisible = await conditionalButton.isVisible().catch(() => false)

	if (conditionalVisible) {
		await conditionalityToggle.check().catch(() => {})
		return conditionalButton
	}

	return page.locator(CHECKOUT_BUTTON_SELECTOR).first()
}

async function waitForCheckoutButton(page, timeoutMs = 15000) {
	const deadline = Date.now() + timeoutMs

	while (Date.now() < deadline) {
		const checkoutButton = await getCheckoutCandidate(page)
		const visible = await checkoutButton.isVisible().catch(() => false)
		const enabled = await checkoutButton.isEnabled().catch(() => false)

		if (visible && enabled) {
			return checkoutButton
		}

		await page.waitForTimeout(500)
	}

	const cartState = await getCartDebugState(page)
	const screenshotPath = await captureScreenshot(page, 'checkout-button-missing')

	throw new Error(
		[
			'Checkout button was not visible/enabled before proceeding to checkout.',
			`Cart state: ${JSON.stringify(cartState, null, 2)}`,
			`Screenshot: ${screenshotPath || 'not captured'}`,
		].join('\n'),
	)
}

async function waitForStorefrontReady(page, timeoutMs) {
	const deadline = Date.now() + timeoutMs

	while (Date.now() < deadline) {
		const ready = await Promise.all([
			page
				.getByRole('button', { name: /i'?m over 21|qualified patient/i })
				.first()
				.isVisible()
				.catch(() => false),
			page.locator('input[name="post_password"]').first().isVisible().catch(() => false),
			page.getByText(/create an account/i).first().isVisible().catch(() => false),
			page.locator('#fulfillmentElement').first().isVisible().catch(() => false),
			page.locator(FALLBACK_ADD_TO_CART_SELECTOR).first().isVisible().catch(() => false),
		])

		if (ready.some(Boolean)) {
			return
		}

		await page.waitForTimeout(1000)
	}

	throw new Error(
		[
			`Storefront was not ready within ${Math.round(timeoutMs / 1000)} seconds.`,
			`Current URL: ${page.url()}`,
			`Body preview: ${await getBodyPreview(page)}`,
		].join('\n'),
	)
}

async function clickIfVisible(locator, timeoutMs = 1000) {
	const visible = await locator
		.waitFor({ state: 'visible', timeout: timeoutMs })
		.then(() => true)
		.catch(() => false)

	if (!visible) {
		return false
	}

	await locator.click()
	return true
}

async function submitListPasswordIfPresent(page) {
	const passwordField = page.locator('input[name="post_password"]').first()
	const visible = await passwordField.isVisible().catch(() => false)

	if (!visible) {
		return
	}

	const password = process.env.ARTILLERY_LIST_PASSWORD || process.env.CHECKOUT_PASSWORD

	if (!password) {
		throw new Error('ARTILLERY_LIST_PASSWORD must be set when the private-store password gate is visible.')
	}

	await passwordField.click()
	await passwordField.fill(password)
	await page.locator('text=enter site').click()
	await page.waitForLoadState('domcontentloaded').catch(() => {})
}

async function passAgeGateIfPresent(page) {
	const accepted = await clickIfVisible(
		page.getByRole('button', { name: /over 21|qualified patient/i }).first(),
		3000,
	)

	if (accepted) {
		await page.waitForLoadState('domcontentloaded').catch(() => {})
	}
}

async function createAccount(page, target, user, step) {
	await step('Open Registration', async () => {
		await page.getByText(/create an account/i).first().click({ timeout: 60000 })
		await page.waitForLoadState('domcontentloaded').catch(() => {})
	})

	await step('Enter Account Info', async () => {
		await page.locator('input[name="svntn_core_registration_firstname"]').fill(user.firstName)
		await page.locator('input[name="svntn_core_registration_lastname"]').fill(user.lastName)
		await page.locator('input[name="email"]').fill(user.email)
		await page.locator('input[name="password"]').fill(user.password)
		await page.locator('select[name="svntn_core_dob_month"]').selectOption('12')
		await page.locator('select[name="svntn_core_dob_day"]').selectOption('16')
		await page.locator('select[name="svntn_core_dob_year"]').selectOption('1988')
		await selectResolvedBillingAddress(
			page,
			DEFAULT_REGISTRATION_ADDRESS,
			DEFAULT_REGISTRATION_STATE,
			DEFAULT_REGISTRATION_ZIP,
		)
		await page.locator('input[name="billing_phone"]').fill(user.phone)
	})

	await step('Submit Registration Form', async () => {
		const nextButton = await waitForRegistrationReadyToSubmit(
			page,
			DEFAULT_REGISTRATION_STATE,
			DEFAULT_REGISTRATION_ZIP,
		)
		await nextButton.click()
		await waitForEligibilityStep(page, target)
	})

	await step('Enter Eligibility Info', async () => {
		await selectRegistrationUsageType(page, user.usageType)
		await uploadDriversLicense(page)
		await page.locator('select[name="svntn_core_pxp_month"]').selectOption('12')
		await page.locator('select[name="svntn_core_pxp_day"]').selectOption('16')
		await page.locator('select[name="svntn_core_pxp_year"]').selectOption(`${new Date().getFullYear() + 1}`)
		await page.getByRole('button', { name: /register/i }).click()
		await page.waitForTimeout(5000)
		await captureScreenshot(page, 'after-register')
	})
}

async function selectFulfillment(page, fulfillmentType, step) {
	await step(`Select ${fulfillmentType} Fulfillment`, async () => {
		const fulfillmentElement = page.locator('#fulfillmentElement').first()
		await fulfillmentElement.waitFor({ state: 'visible', timeout: 60000 })

		const fulfillmentOption = fulfillmentElement.getByText(fulfillmentType, { exact: true }).first()
		await fulfillmentOption.click()

		const submit = page.locator(
			[
				'#fulfillmentElement button.wpse-button-primary:has-text("Submit")',
				'#fulfillmentElement button:has-text("Submit")',
				'#fulfillmentElement a.wpse-button-primary:has-text("Submit")',
				'#fulfillmentElement [role="button"]:has-text("Submit")',
				'button:has-text("Submit")',
			].join(', '),
		)
		await submit.first().click()
		await page.waitForLoadState('domcontentloaded').catch(() => {})
	})
}

async function getAddToCartButtons(page, usageType) {
	const primarySelector =
		usageType === 'Recreational' ? RECREATIONAL_ADD_TO_CART_SELECTOR : MEDICAL_ADD_TO_CART_SELECTOR

	const primaryVisible = await page
		.waitForSelector(primarySelector, { timeout: 30000 })
		.then(() => true)
		.catch(() => false)

	if (primaryVisible) {
		return page.locator(primarySelector)
	}

	await page.locator(FALLBACK_ADD_TO_CART_SELECTOR).first().waitFor({ state: 'visible', timeout: 30000 })
	return page.locator(FALLBACK_ADD_TO_CART_SELECTOR)
}

async function addItemsToCart(page, usageType, itemCount, step) {
	await step('Add Items To Cart', async () => {
		const addToCartButtons = await getAddToCartButtons(page, usageType)
		const addToCartButtonCount = await addToCartButtons.count()

		if (addToCartButtonCount < itemCount) {
			throw new Error(
				[
					`Requested ${itemCount} cart items, but only found ${addToCartButtonCount} add-to-cart buttons.`,
					`Usage type: ${usageType}`,
					`Current URL: ${page.url()}`,
					`Body preview: ${await getBodyPreview(page)}`,
				].join('\n'),
			)
		}

		for (let index = 0; index < itemCount; index += 1) {
			await addToCartButtons.nth(index).click({ force: true })
			await page.waitForTimeout(2000)
		}

		await captureScreenshot(page, 'after-add-items-to-cart')
	})
}

async function reviewCartAndProceed(page, step) {
	await step('Review Cart', async () => {
		await page.locator('a.cart-contents, .cart-contents').first().click()
		await page.waitForLoadState('domcontentloaded').catch(() => {})
		console.log(`[cart] ${JSON.stringify(await getCartDebugState(page))}`)
		await captureScreenshot(page, 'cart-page-before-checkout')
	})

	await step('Navigate To Checkout', async () => {
		const checkoutButton = await waitForCheckoutButton(page)
		await checkoutButton.click()
		await page.waitForLoadState('domcontentloaded').catch(() => {})
		await captureScreenshot(page, 'checkout-page')
	})
}

async function selectAcuitySlot(page) {
	const errorMessage = page.locator('#datetimeError').first()

	await page.waitForTimeout(2000)

	if (await errorMessage.isVisible().catch(() => false)) {
		return
	}

	await page.waitForSelector('#svntnAcuityDayChoices >> .acuityChoice', {
		timeout: 45 * 1000,
	})

	await page.locator('#svntnAcuityDayChoices >> .acuityChoice').first().click()
	await page.waitForSelector('#svntnAcuityTimeChoices >> .acuityChoice')
	await page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first().click()
}

async function checkout(page, step) {
	await step('Select Acuity Slot', async () => {
		await selectAcuitySlot(page)
	})

	await step('Handle Place Order', async () => {
		const placeOrderButton = page.locator('#place_order').first()
		await placeOrderButton.waitFor({ state: 'visible', timeout: 30000 })
		await waitForLocatorEnabled(page, placeOrderButton, 'Place order button', 30000)

		if (!shouldPlaceOrders()) {
			console.log('[checkout] PLACE_ORDERS is false; stopping before order submission.')
			await captureScreenshot(page, 'ready-to-place-order')
			return
		}

		await placeOrderButton.click()
		await page.waitForLoadState('domcontentloaded').catch(() => {})
		await captureScreenshot(page, 'after-place-order')
	})
}

function buildUser() {
	const firstName = pick(FIRST_NAMES)
	const lastName = pick(LAST_NAMES)
	const email = `loadtest-${firstName.toLowerCase()}.${lastName.toLowerCase()}.${randomNumber()}@loadtest.com`

	return {
		firstName,
		lastName,
		email,
		password: email,
		phone: randomPhoneNumber(),
		usageType: getUsageType(),
		fulfillmentType: getFulfillmentType(),
	}
}

async function runFunnel(page, vuContext, events, test, options = {}) {
	const step = getStep(test)
	const target = getTarget(vuContext)
	const user = buildUser()
	const itemCount = getCartCount()
	const vip = Boolean(options.vip)
	const readyWaitMs = parsePositiveInt(
		options.readyWaitMs || process.env.ARTILLERY_READY_WAIT_MS,
		DEFAULT_READY_WAIT_MS,
	)
	const queueWaitMs = parsePositiveInt(
		options.queueWaitMs || process.env.ARTILLERY_QUEUE_WAIT_MS,
		vip ? readyWaitMs : DEFAULT_QUEUE_WAIT_MS,
	)

	await measuredStep(events, step, 'cookies', 'Inject QA Cookies', async () => {
		await addQaCookies(page, target, { vip })
	})

	await measuredStep(events, step, 'load_storefront', 'Load Storefront', async () => {
		await page.goto(target, { waitUntil: 'domcontentloaded' })
		if (vip && page.url().includes('queue-it.net')) {
			throw new Error(`Bypass scenario unexpectedly entered Queue-It: ${page.url()}`)
		}
		await waitForStorefrontReady(page, queueWaitMs)
		if (page.url().includes('queue-it.net')) {
			throw new Error(`Storefront did not leave Queue-It before the wait window expired: ${page.url()}`)
		}
		await captureScreenshot(page, 'storefront-loaded')
	})

	await measuredStep(events, step, 'age_gate', 'Pass Age Gate', async () => {
		await passAgeGateIfPresent(page)
		await waitForStorefrontReady(page, readyWaitMs)
	})

	await measuredStep(events, step, 'list_password', 'Enter List Password', async () => {
		await submitListPasswordIfPresent(page)
		await page.waitForLoadState('domcontentloaded').catch(() => {})
		await waitForStorefrontReady(page, readyWaitMs)
	})

	await measuredStep(events, step, 'create_account', 'Create Account', async () => {
		await createAccount(page, target, user, step)
	})

	await measuredStep(events, step, 'fulfillment', 'Select Fulfillment', async () => {
		await selectFulfillment(page, user.fulfillmentType, step)
	})
	await measuredStep(events, step, 'add_to_cart', 'Add To Cart', async () => {
		await addItemsToCart(page, user.usageType, itemCount, step)
	})
	await measuredStep(events, step, 'cart_checkout_nav', 'Cart To Checkout', async () => {
		await reviewCartAndProceed(page, step)
	})
	await measuredStep(events, step, 'checkout', 'Checkout', async () => {
		await checkout(page, step)
	})
}

async function storeFunnelBypass(page, vuContext, events, test) {
	return runFunnel(page, vuContext, events, test, { vip: true })
}

async function storeFunnelRealQueue(page, vuContext, events, test) {
	return runFunnel(page, vuContext, events, test, {
		vip: false,
	})
}

module.exports = {
	RECAPTCHA_BYPASS_COOKIE_NAME,
	VIP_CHECKER_COOKIE_NAME,
	buildCookies,
	runFunnel,
	storeFunnelBypass,
	storeFunnelRealQueue,
}
