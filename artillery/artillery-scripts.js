const fs = require('fs')
const path = require('path')
const { addQaCookies } = require('./qa-cookies')

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
const DEFAULT_CART_ITEM_COUNT = 6
const CHECKOUT_BUTTON_SELECTOR = [
	'.checkout-button',
	'a.checkout-button',
	'.wc-proceed-to-checkout .wcse-checkout-button.wcse-warning-button',
	'.wcse-checkout-button.wcse-warning-button',
	'button:has-text("Continue to checkout")',
	'a:has-text("Continue to checkout")',
].join(', ')
const DEBUG_SCREENSHOT_DIR = path.resolve(__dirname, 'debug-screenshots')

function normalizeZip(value) {
	return String(value || '').trim().slice(0, 5)
}

async function getBodyPreview(page) {
	const bodyText = await page.locator('body').textContent().catch(() => '')

	return (bodyText || '').replace(/\s+/g, ' ').trim().slice(0, 1000)
}

function shouldCaptureDebugScreenshots() {
	return process.env.ARTILLERY_DEBUG_SCREENSHOTS === 'true'
}

function parsePositiveInt(rawValue, fallback) {
	const parsed = Number.parseInt(rawValue, 10)

	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getCartCount() {
	return parsePositiveInt(process.env.ARTILLERY_CART_ITEM_COUNT, DEFAULT_CART_ITEM_COUNT)
}

async function captureDebugScreenshot(page, label) {
	if (!shouldCaptureDebugScreenshots()) {
		return undefined
	}

	fs.mkdirSync(DEBUG_SCREENSHOT_DIR, { recursive: true })

	const safeLabel = label.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
	const screenshotPath = path.join(DEBUG_SCREENSHOT_DIR, `${Date.now()}-${safeLabel}.png`)

	await page.screenshot({ path: screenshotPath, fullPage: true }).catch(error => {
		console.warn(`[DEBUG] Could not capture screenshot "${label}": ${error.message}`)
	})

	return screenshotPath
}

async function getCartDebugState(page) {
	const checkoutButton = page.locator(CHECKOUT_BUTTON_SELECTOR).first()
	const cartItems = page.locator('.cart_item')
	const notices = await page
		.locator('.woocommerce-message, .woocommerce-error, .wc-block-components-notice-banner, .notyf__toast')
		.allTextContents()
		.catch(() => [])

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

async function waitForCheckoutButton(page, timeoutMs = 15000) {
	const checkoutButton = page.locator(CHECKOUT_BUTTON_SELECTOR).first()
	const deadline = Date.now() + timeoutMs

	while (Date.now() < deadline) {
		const visible = await checkoutButton.isVisible().catch(() => false)
		const enabled = await checkoutButton.isEnabled().catch(() => false)

		if (visible && enabled) {
			return checkoutButton
		}

		await page.waitForTimeout(500)
	}

	const cartState = await getCartDebugState(page)
	const screenshotPath = await captureDebugScreenshot(page, 'checkout-button-missing')

	throw new Error(
		[
			'Checkout button was not visible/enabled before proceeding to checkout.',
			`Cart state: ${JSON.stringify(cartState, null, 2)}`,
			`Screenshot: ${screenshotPath || 'not captured'}`,
		].join('\n'),
	)
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

async function CA(page, vuContext, events, test) {
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

		const randomIndex = Math.floor(Math.random() * firstNames.length)
		return firstNames[randomIndex]
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

		const randomIndex = Math.floor(Math.random() * lastNames.length)
		return lastNames[randomIndex]
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

	function getRandomUsageType() {
		const randomNumber = Math.random()

		return randomNumber < 0.5 ? 'Medical' : 'Recreational'
	}

	function getRandomFulfillmentType() {
		const randomNumber = Math.random()

		return randomNumber < 0.5 ? 'Pickup' : 'Delivery'
	}

	const { step } = test
	const userid = vuContext.vars.userid
	const recordid = vuContext.vars.recordid
	const userFirstName = randomFirstName()
	const userLastName = randomLastName()
	const userEmail = `loadtest-${userFirstName.toLowerCase()}.${userLastName.toLowerCase()}.${randomNumber()}@loadtest.com`
	const userAddress = '3377 S La Cienega Blvd, Los Angeles, CA 90016'
	const userState = 'CA'
	const userZip = '90016'
	const usageType = getRandomUsageType()
	const fulfillmentType = getRandomFulfillmentType()
	const itemCount = getCartCount()
	const target = vuContext.vars.target || 'https://thelist-dev.710labs.com'

	// Inject QA cookies before navigation
	await addQaCookies(page, target)

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
			const passwordField = await page.locator('input[name="post_password"]')
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
				await firstName.fill(userFirstName)
			})

			await step('Enter Last Name', async () => {
				const lastName = page.locator('input[name="svntn_core_registration_lastname"]')
				await lastName.click()
				await lastName.fill(userLastName)
			})

			await step('Enter Email', async () => {
				const emailField = await page.locator('input[name="email"]')
				await emailField.click()
				await emailField.fill(userEmail)
			})

			await step('Enter Password', async () => {
				const passwordField = page.locator('input[name="password"]')
				await passwordField.click()
				await passwordField.fill(userEmail)
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
				await address.fill(userAddress)
				await page.waitForTimeout(1000)
				await page.keyboard.press('ArrowDown')
				await page.keyboard.press('Enter')
			})

			await step('Enter Phone Number', async () => {
				const phoneNumber = page.locator('input[name="billing_phone"]')
				await phoneNumber.click()
				await phoneNumber.fill(randomPhoneNumber())
			})

			await step('Submit New Customer Form', async () => {
				const nextButton = await waitForRegistrationReadyToSubmit(page, userState, userZip)
				await page.waitForTimeout(2000)
				await nextButton.click()
				await waitForEligibilityStep(page, target)
			})
		})

		await step('Enter Validation Info', async () => {
			await step('Submit Drivers License', async () => {
				await step('Upload DL File', async () => {
					const dlUploadButton = await page.waitForSelector('input[name="svntn_core_personal_doc"]')
					const [driversLicenseChooser] = await Promise.all([
						page.waitForEvent('filechooser'),
						dlUploadButton.click(),
					])
					await page.waitForTimeout(5000)
					await driversLicenseChooser.setFiles('CA-DL.jpg')
					await waitForPersonalDocumentAccepted(page)
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
				// 	await step('Upload Med Card File', async () => {
				// 		const medCardUploadButton = await page.waitForSelector(
				// 			'input[name="svntn_core_medical_doc"]',
				// 		)
				// 		const [medicalCardChooser] = await Promise.all([
				// 			page.waitForEvent('filechooser'),
				// 			medCardUploadButton.click(),
				// 		])
				// 		await page.waitForTimeout(5000)
				// 		await medicalCardChooser.setFiles('Medical-Card.png')
				// 		await page.waitForTimeout(5000)
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

				// 		await medicalCardExpMonth.selectOption('12')
				// 		await medicalCardExpDay.selectOption('16')
				// 		await medicalCardExpYear.selectOption(`${new Date().getFullYear() + 1}`)
				// 	})
				// })

			await step('Submit Validation Info', async () => {
				await page.getByRole('button', { name: 'Register' }).click()
				await page.waitForTimeout(5000)
			})
		})
		await step('Select Fulfillment Type', async () => {
			await step(`Select ${fulfillmentType}`, async () => {
				await page
					.locator('#fulfillmentElement')
					.getByText(fulfillmentType, { exact: true })
					.click()
			})
			await step(`Submit ${fulfillmentType} Fulfillment`, async () => {
				await page.getByRole('button', { name: 'Submit' }).click()
			})
		})
	})

	await step('Create Cart', async () => {
		await step('Add Items To Cart', async () => {
			await page.waitForTimeout(5000)
			var addToCartButtons
			if (usageType === 'Recreational') {
				await page.waitForSelector(
					'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test")) and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]',
				)
				await page.waitForTimeout(5000)
				addToCartButtons = await page.locator(
					'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test")) and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]',
				)
			} else {
				await page.waitForSelector(
					'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test"))]//a[contains(@aria-label, "Add to cart:")]',
				)
				await page.waitForTimeout(5000)
				addToCartButtons = await page.locator(
					'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test"))]//a[contains(@aria-label, "Add to cart:")]',
				)
			}

				const indices = Array.from({ length: itemCount }, (_, index) => index)
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

				for (let i = indices.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1))
				;[indices[i], indices[j]] = [indices[j], indices[i]]
			}

			for (const index of indices) {
				await addToCartButtons.nth(index).click({ force: true })
				await page.waitForTimeout(2000)
			}

			await captureDebugScreenshot(page, 'after-add-items-to-cart')
		})
		// await step('Add Promo Item To Cart', async () => {
		// 	await page.waitForTimeout(5000)
		// 	var addToCartButtons

		// 	if (usageType === 'Recreational') {
		// 		await page.waitForSelector(
		// 			'//li[contains(@class, "product_cat-woo-import-test") and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]',
		// 		)
		// 		await page.waitForTimeout(5000)
		// 		addToCartButtons = await page.locator(
		// 			'//li[contains(@class, "product_cat-woo-import-test") and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]',
		// 		)
		// 	} else {
		// 		await page.waitForSelector(
		// 			'//li[contains(@class, "product_cat-woo-import-test")]//a[contains(@aria-label, "Add to cart:")]',
		// 		)
		// 		await page.waitForTimeout(5000)
		// 		addToCartButtons = await page.locator(
		// 			'//li[contains(@class, "product_cat-woo-import-test")]//a[contains(@aria-label, "Add to cart:")]',
		// 		)
		// 	}

		// 	const indices = Array.from({ length: 2 }, (_, index) => index)

		// 	for (let i = indices.length - 1; i > 0; i--) {
		// 		const j = Math.floor(Math.random() * (i + 1))
		// 		;[indices[i], indices[j]] = [indices[j], indices[i]]
		// 	}

		// 	await step('Choose Promo Item', async () => {
		// 		await addToCartButtons.nth(0).click({ force: true })
		// 		await page.waitForTimeout(2000)
		// 	})

		// 	await step('Validate Promo Restrictions ', async () => {
		// 		await addToCartButtons.nth(1).click({ force: true })
		// 		await page.waitForTimeout(2000)
		// 		await page.waitForSelector('.notyf__dismiss-btn')
		// 		await page.locator('.notyf__dismiss-btn').click()
		// 	})
		// })

			await step('Review Cart', async () => {
				console.log(`[DEBUG] Reviewing Cart. URL: ${page.url()}`)
				await step('Navigate To Cart', async () => {
					await page.locator('a.cart-contents').click()
					console.log(`[DEBUG] In Cart. URL: ${page.url()}`)
					await page.waitForLoadState('domcontentloaded').catch(() => {})
					const cartState = await getCartDebugState(page)
					console.log(`[DEBUG_CART_STATE] ${JSON.stringify(cartState)}`)
					await captureDebugScreenshot(page, 'cart-page-before-checkout')
				})
				await step('Navigate To Checkout', async () => {
					const checkoutButton = await waitForCheckoutButton(page)
					await checkoutButton.click()
					console.log(`[DEBUG] At Checkout. URL: ${page.url()}`)
				})
			})
	})

	await step('Checkout Cart', async () => {
		console.log(`[DEBUG] Starting Checkout. URL: ${page.url()}`)
		await step('Enter Fulfillment Info', async () => {
			await step('Select Acuity Slot', async () => {
				await page.waitForTimeout(2000)
				const errorMessage = page.locator('#datetimeError')

				if (!(await errorMessage.isVisible())) {
					await page.waitForSelector('#svntnAcuityDayChoices >> .acuityChoice', {
						timeout: 45 * 1000,
					})

					const daySlot = page.locator('#svntnAcuityDayChoices >> .acuityChoice').first()
					await daySlot.click()

					await page.waitForSelector('#svntnAcuityTimeChoices >> .acuityChoice')

					const timeSlot = page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first()
					await timeSlot.click()
				}
			})
		})

		await step('Complete Order', async () => {
			const placeOrderButton = page.locator('id=place_order')
			await placeOrderButton.waitFor({ state: 'visible' })
			await placeOrderButton.click()
		})
	})
}

async function CO(page) {}

async function MI(page) {}

module.exports = {
	CA,
	CO,
	MI,
}
