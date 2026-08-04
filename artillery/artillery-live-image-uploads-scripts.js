const path = require('path')
const { addQaCookies } = require('./qa-cookies')
const { DRIVER_LICENSE_FILES, MED_CARD_FILES } = require('./image-upload-fixtures')

const DEFAULT_TARGET = 'https://live-dev.710labs.com'
const LIVE_AUTHENTICATION_ADDRESS = '440 Rodeo Drive Beverly Hills'
const DEFAULT_TIMEOUT_MS = 30000
const ADMIN_AJAX_PATH = '/wp-admin/admin-ajax.php'

const PRODUCT_SELECTOR = 'li.product.type-product'
const AUTH_MODAL_SELECTOR = 'section.wpse-component #renderGateway'
const ACCOUNT_LINK_SELECTOR = 'a[href*="/my-account"]'
const CART_DRAWER_SELECTOR = [
	'.wpse-drawer[data-module="cart"]',
	'.wpse-drawer[data-module="cart-response"]',
].join(', ')

const DOCUMENT_TYPES = {
	photoId: {
		editLinkSelector: 'a.specific-link[data-module="iddoc"]',
		drawerSelector: '.wpse-drawer:has(h2:has-text("Replace your ID on file"))',
		fileInputSelector: 'input#fasd_doc',
		expirationInputSelector: 'input#doc_exp',
		files: DRIVER_LICENSE_FILES,
		label: 'Photo ID',
		summaryTextSelector:
			'div.wpse-account-component:has(header:has-text("Photo ID")) .wpse-document-meta p',
	},
	medicalCard: {
		editLinkSelector: 'a.specific-link[data-module="meddoc"]',
		drawerSelector: '.wpse-drawer:has(h2:has-text("Replace your med card on file"))',
		fileInputSelector: 'input#fasd_medcard',
		expirationInputSelector: 'input#medcard_exp',
		files: MED_CARD_FILES,
		label: 'Medical Card',
		summaryTextSelector:
			'div.wpse-account-component:has(header:has-text("Medical card")) .wpse-document-meta p',
	},
}

function getTarget(vuContext) {
	return vuContext.vars.target || process.env.ARTILLERY_TARGET || DEFAULT_TARGET
}

function getLivePassword() {
	const password = process.env.ARTILLERY_LIVE_PASSWORD

	if (!password?.trim()) {
		throw new Error('ARTILLERY_LIVE_PASSWORD is required for Live image-upload runs')
	}

	return password
}

function createLiveUser() {
	const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
	const nameSuffix = uniqueSuffix.replace(/[^a-zA-Z0-9]/g, '').slice(-12)

	return {
		dob: '1985-01-02',
		email: `test_710_load_live_med_${uniqueSuffix}@test.com`,
		firstName: `LoadTest${nameSuffix}`,
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

		const productName = (
			(await product
				.locator('.woocommerce-loop-product__title')
				.textContent()
				.catch(() => '')) ||
			`product ${index + 1}`
		).trim()
		const productLink = product
			.locator('.woocommerce-loop-product__link, img.wp-post-image, img')
			.first()

		await productLink.waitFor({ state: 'visible' })
		await productLink.click()
		await page.waitForLoadState('domcontentloaded').catch(() => {})

		const addToCartButton = page.getByRole('button', { name: /add to cart/i }).first()
		await addToCartButton.waitFor({ state: 'visible', timeout: 15000 })
		await addToCartButton.click({ force: true })
		console.log(`[LIVE_IMAGE_UPLOAD] Triggered registration with ${productName}`)

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
	const cartDrawers = page.locator(CART_DRAWER_SELECTOR)
	const cartDrawer = await getVisibleLocator(cartDrawers)

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
	await page.locator('h3:has-text("Medical card")').waitFor({ state: 'visible' })
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
		async response => {
			if (
				response.request().method() !== 'POST' ||
				!response.url().includes(ADMIN_AJAX_PATH)
			) {
				return false
			}

			const payload = await response.json().catch(() => null)
			return Boolean(
				payload &&
				(typeof payload.outcome === 'string' ||
					typeof payload.successCloserize === 'boolean' ||
					typeof payload.success === 'boolean' ||
					payload.errors),
			)
		},
		{ timeout: DEFAULT_TIMEOUT_MS },
	)
}

function assertSuccessfulDocumentResponse(payload, documentLabel, filename) {
	const errors =
		payload?.errors && Object.keys(payload.errors).length > 0 ? payload.errors : null
	const succeeded =
		payload?.outcome === 'success' ||
		payload?.successCloserize === true ||
		payload?.success === true

	if (errors || !succeeded) {
		throw new Error(
			`${documentLabel} upload failed for ${filename}: ${JSON.stringify({
				errors,
				message: payload?.message,
				outcome: payload?.outcome,
				success: payload?.success,
				successCloserize: payload?.successCloserize,
			})}`,
		)
	}
}

async function waitForSummary(page, documentType, expectedExpiration) {
	await page.waitForFunction(
		({ summarySelector, expectedText }) =>
			Array.from(document.querySelectorAll(summarySelector)).some(element =>
				element.textContent?.includes(expectedText),
			),
		{
			expectedText: expectedExpiration,
			summarySelector: documentType.summaryTextSelector,
		},
		{ timeout: DEFAULT_TIMEOUT_MS },
	)
}

async function uploadLiveDocument(page, documentType, filename, expiration) {
	await clickVisible(page.locator(documentType.editLinkSelector))

	const drawer = await waitForVisibleLocator(page.locator(documentType.drawerSelector))
	const fileInput = drawer.locator(documentType.fileInputSelector)
	const expirationInput = drawer.locator(documentType.expirationInputSelector)
	const resolvedFilePath = path.resolve(__dirname, filename)

	await fileInput.waitFor({ state: 'attached' })
	await fileInput.setInputFiles(resolvedFilePath)
	await waitForSelectedFilename(fileInput, filename)
	await expirationInput.fill(expiration.input)

	if (documentType === DOCUMENT_TYPES.medicalCard) {
		await drawer.locator('select#medcard_state').selectOption('CA')
		await drawer
			.locator('input#medcard_no')
			.fill(`${Math.floor(10000000 + Math.random() * 90000000)}`)
	}

	const responsePromise = waitForDocumentUpdateResponse(page)
	const saveButton = drawer.locator('.fasd-form-submit').first()
	await saveButton.waitFor({ state: 'visible' })
	await saveButton.evaluate(element => element.click())

	const response = await responsePromise
	const payload = await response.json()
	assertSuccessfulDocumentResponse(payload, documentType.label, filename)
	await drawer.waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT_MS })
	await waitForSummary(page, documentType, expiration.display)
}

async function uploadDocumentMatrix(page, step, documentType, startDay) {
	const expirationYear = new Date().getFullYear() + 1

	for (let index = 0; index < documentType.files.length; index += 1) {
		const filename = documentType.files[index]
		const day = String(startDay + index).padStart(2, '0')
		const expiration = {
			display: `04/${day}/${expirationYear}`,
			input: `${expirationYear}-04-${day}`,
		}

		await step(`Live ${documentType.label}: ${filename}`, async () => {
			await uploadLiveDocument(page, documentType, filename, expiration)
		})
	}
}

async function LiveImageUploads(page, vuContext, events, test) {
	const { step } = test
	const target = getTarget(vuContext)
	const user = createLiveUser()

	await addQaCookies(page, target)

	await step('Live: Select Store and Reach Registration', async () => {
		await page.goto(target)
		await page.locator('span.site-header-group').waitFor({ state: 'visible', timeout: 20000 })
		await enterLiveAddress(page)
		await addNonMedicalProduct(page)
	})

	await step('Live: Register Test Account', async () => {
		await registerLiveUser(page, user)
		console.log(`[LIVE_IMAGE_UPLOAD] Registered ${user.email}`)
	})

	await step('Live: Open My Account', async () => {
		await goToAccountPage(page, target)
	})

	await uploadDocumentMatrix(page, step, DOCUMENT_TYPES.photoId, 10)
	await uploadDocumentMatrix(page, step, DOCUMENT_TYPES.medicalCard, 20)
}

module.exports = {
	LiveImageUploads,
}
