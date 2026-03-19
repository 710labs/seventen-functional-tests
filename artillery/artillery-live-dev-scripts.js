const dotenv = require('dotenv')
const findConfig = require('find-config')

dotenv.config({ path: findConfig('.env') || undefined })

const DEFAULT_TARGET = 'https://live-dev.710labs.com'
const DEFAULT_ADDRESS = '440 N Rodeo Dr, Beverly Hills, CA 90210'
const UPDATED_ADDRESS = '2919 S La Cienega Blvd, Culver City, CA 90232'
const HOME_HEADER_SELECTOR = 'span.site-header-group'
const PRODUCT_SELECTOR = 'li.product.type-product.product-type-simple.status-publish'

function getTarget(vuContext) {
	return vuContext?.vars?.target || process.env.ARTILLERY_TARGET || DEFAULT_TARGET
}

function getRegistrationPassword() {
	const password = process.env.ARTILLERY_REGISTRATION_PASSWORD || process.env.ALWAYS_ON_PASSWORD

	if (!password) {
		throw new Error(
			'Missing registration password. Set ARTILLERY_REGISTRATION_PASSWORD or ALWAYS_ON_PASSWORD.',
		)
	}

	return password
}

function sanitizeForEmail(value) {
	return String(value || 'vu')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, 24)
}

function buildUniqueEmail(vuContext) {
	const vuId = sanitizeForEmail(
		vuContext?.vars?.$uuid || vuContext?.vars?.$id || vuContext?.vars?.$sessionId || 'vu',
	)
	const timestamp = Date.now()
	const random = Math.floor(Math.random() * 1000000)

	return `artillery_live_rec_${vuId}_${timestamp}_${random}@test.com`
}

function buildAdultDob() {
	const dob = new Date()
	dob.setFullYear(dob.getFullYear() - 30)

	return dob.toISOString().split('T')[0]
}

function buildPhoneNumber() {
	const middle = Math.floor(Math.random() * 900) + 100
	const last = Math.floor(Math.random() * 9000) + 1000

	return `555-${middle}-${last}`
}

function buildIdExpiration(offsetYears) {
	const year = new Date().getFullYear() + offsetYears
	return `04/10/${year}`
}

function normalizePhone(value) {
	return String(value || '').replace(/\D/g, '')
}

async function waitForVisible(locator, label, timeout = 30000) {
	try {
		await locator.waitFor({ state: 'visible', timeout })
	} catch (error) {
		throw new Error(`${label} was not visible within ${timeout}ms.`)
	}
}

async function clickVisible(locator, label, timeout = 30000) {
	await waitForVisible(locator, label, timeout)
	await locator.click({ force: true })
}

async function fillVisible(locator, value, label, timeout = 30000) {
	await waitForVisible(locator, label, timeout)
	await locator.fill(value)
}

async function expectTextContains(locator, expected, label, timeout = 30000) {
	await waitForVisible(locator, label, timeout)
	const actual = (await locator.textContent()) || ''

	if (!actual.includes(expected)) {
		throw new Error(`${label} did not include "${expected}". Actual text: "${actual}"`)
	}
}

async function expectPhoneMatches(locator, expected, label, timeout = 30000) {
	await waitForVisible(locator, label, timeout)
	const actual = normalizePhone(await locator.textContent())

	if (actual !== normalizePhone(expected)) {
		throw new Error(`${label} did not match expected phone value. Actual: "${actual}"`)
	}
}

async function chooseAutocompleteSuggestion(page) {
	const suggestion = page.locator('.pac-item').first()
	await waitForVisible(suggestion, 'Address autocomplete suggestion', 20000)
	await suggestion.click()
}

async function handleCartConflict(page) {
	const conflictModal = page.locator('.wpse-drawer[data-module="cart-conflict"]')

	try {
		await conflictModal.waitFor({ state: 'visible', timeout: 4000 })
	} catch (error) {
		return
	}

	const startNewCartButton = conflictModal.locator('button:has-text("Start a new cart")')
	await clickVisible(startNewCartButton, 'Start a new cart button', 10000)
	await conflictModal.waitFor({ state: 'hidden', timeout: 10000 })
}

async function ensureSignedInShop(page) {
	await waitForVisible(page.locator(HOME_HEADER_SELECTOR), 'Site header')
	await waitForVisible(page.locator('svg.icon.icon-account').first(), 'Account icon')
	await waitForVisible(page.locator('a.wpse-cart-openerize').first(), 'Cart button')
	await waitForVisible(
		page.locator('h1.shop-category-head:has-text("Shop by Category")'),
		'Shop by Category heading',
	)
}

async function openHomepage(page, target) {
	await page.goto(target, { waitUntil: 'networkidle' })
	await ensureSignedInShop(page)
}

async function openAddressDrawer(page) {
	const buttons = page.locator('a.wpse-button-storenav.wpse-openerize')
	const submitButton = page.locator('button.wpse-button-primary.fasd-form-submit').first()
	const count = await buttons.count()

	for (let index = 0; index < count; index++) {
		const button = buttons.nth(index)

		if (!(await button.isVisible())) {
			continue
		}

		await button.click({ force: true })

		if (await submitButton.isVisible()) {
			return
		}
	}

	throw new Error('Unable to open the live address drawer.')
}

async function enterAddress(page, address) {
	await openAddressDrawer(page)
	await waitForVisible(
		page.locator('div.wpse-drawer[data-module="fulfillment"]'),
		'Fulfillment drawer',
	)
	await fillVisible(page.locator('#fasd_address'), address, 'Address field')
	await chooseAutocompleteSuggestion(page)
	await clickVisible(
		page.locator('button.wpse-button-primary.fasd-form-submit').first(),
		'Address submit button',
	)
	await page.waitForLoadState('networkidle').catch(() => null)
	await page.waitForTimeout(1500)
}

async function getNonMedicalProduct(page, startIndex = 1) {
	const products = page.locator(PRODUCT_SELECTOR)
	await waitForVisible(products.first(), 'Product list', 20000)
	const count = await products.count()

	for (let index = startIndex; index < count; index++) {
		const product = products.nth(index)
		const hasMedicalOnlyTag =
			(await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

		if (hasMedicalOnlyTag) {
			continue
		}

		return product
	}

	throw new Error('Unable to find a non-medical product on the live-dev shop page.')
}

async function addInitialProductToTriggerAuth(page) {
	const product = await getNonMedicalProduct(page, 1)
	const productImage = product.locator('img.woocommerce-placeholder.wp-post-image')

	await clickVisible(productImage, 'Initial product image')
	await clickVisible(page.getByRole('button', { name: /^add to cart$/i }).first(), 'Add to cart button')
	await handleCartConflict(page)
	await waitForVisible(page.locator('section.wpse-component #renderGateway'), 'Auth gateway modal')
}

async function registerUniqueUser(page, vuContext) {
	const email = buildUniqueEmail(vuContext)
	const password = getRegistrationPassword()
	const firstName = 'Artillery'
	const lastName = 'LiveRec'

	console.log(`[artillery-live-dev] registering user ${email}`)

	await fillVisible(page.locator('#fasd_email'), email, 'Registration email input')
	await clickVisible(page.locator('button:has-text("Continue")'), 'Continue button')
	await fillVisible(page.locator('input.fasd-form-value#password'), password, 'Registration password')
	await fillVisible(page.locator('input.fasd-form-value#reg_fname'), firstName, 'Registration first name')
	await fillVisible(page.locator('input.fasd-form-value#reg_lname'), lastName, 'Registration last name')

	const zipField = page.locator('input.fasd-form-value#reg_postcode')
	if (await zipField.isVisible()) {
		await zipField.fill('90232')
	}

	await fillVisible(page.locator('input.fasd-form-value#reg_dob'), buildAdultDob(), 'Registration DOB')
	await clickVisible(page.locator('button:has-text("Create Account")'), 'Create Account button')
	await page.locator('section.wpse-component #renderGateway').waitFor({ state: 'hidden', timeout: 30000 })
	await ensureSignedInShop(page)

	return { email }
}

async function returnToShop(page) {
	await clickVisible(page.locator('a[rel="home"] h1.site-title'), 'Home button')
	await page.waitForLoadState('networkidle').catch(() => null)
	await ensureSignedInShop(page)
}

async function addProductsUntilMinimumMet(page) {
	const products = page.locator(PRODUCT_SELECTOR)
	await waitForVisible(products.first(), 'Product list', 20000)
	const totalProducts = await products.count()
	const minimumBanner = page.locator('div.wpse-snacktoast').first()
	const viewCartButton = page.locator(
		'a.button.wpse-button-primary.wpse-cart-openerize[data-shape="drawer"][data-module="cart"][href="/cart"]',
	)
	const continueShoppingButton = page.locator('a:has-text("Add more items")')
	const cartDrawer = page.locator('#cartDrawer')

	for (let index = 3; index < totalProducts; index++) {
		const product = products.nth(index)
		const hasMedicalOnlyTag =
			(await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

		if (hasMedicalOnlyTag) {
			continue
		}

		const addToCartButton = product.locator(
			'button.product_type_simple.fasd_to_cart.ajax_groove',
		)

		if (!(await addToCartButton.isVisible())) {
			continue
		}

		await product.scrollIntoViewIfNeeded()
		await addToCartButton.click({ force: true })
		await handleCartConflict(page)
		await waitForVisible(cartDrawer, 'Cart drawer', 15000)

		const minimumStillRequired = await minimumBanner.isVisible()

		if (!minimumStillRequired) {
			await clickVisible(viewCartButton, 'View cart button')
			await waitForVisible(page.locator('h6:has-text("Your cart from")'), 'Cart page title')
			await clickVisible(
				page.locator('a.checkout-button.button.alt.wc-forward'),
				'Continue to checkout button',
			)
			return
		}

		await clickVisible(viewCartButton, 'View cart button')
		await clickVisible(continueShoppingButton, 'Add more items button')
		await page.waitForTimeout(1500)
	}

	throw new Error('Unable to reach the live-dev cart minimum before exhausting visible products.')
}

async function saveCheckoutSection(sectionLocator, label) {
	const button = sectionLocator.locator('a.wpse-button-primary.fasd-form-submit').first()
	await clickVisible(button, label)
}

async function completeCheckoutFlow(page) {
	const checkoutTitle = page.locator('h2:has-text("Checkout")')
	const displayedAddress = page.locator('p.--reactive-long-origin').first()
	const addressEditor = page.locator('a.wpse-checkout-unroller:has-text("Edit")').first()
	const addNewAddressButton = page.locator('label:has-text("Add new address")')
	const modalAddressField = page.locator('#fasd_address')
	const modalAddressSaveButton = page.locator('button.wpse-button-primary.fasd-form-submit').first()
	const deliverySection = page.locator('#checkout_appointment.wpse-checkout-subcomponent')
	const yourInfoSection = page.locator('#checkout_info_step')
	const documentsSection = page.locator('#checkout_id')
	const paymentSection = page.locator('div#checkout_payment_step')
	const orderReviewSection = page.locator('#checkout_checkout')
	const checkoutPasswordField = page.locator('#dev_pswrd')
	const placeOrderButton = page.locator('#place_order')

	await waitForVisible(checkoutTitle, 'Checkout title')
	await waitForVisible(yourInfoSection, 'Checkout info section')
	await expectTextContains(displayedAddress, 'Beverly Hills', 'Initial checkout address')

	await clickVisible(addressEditor, 'Checkout address edit button')
	await clickVisible(addNewAddressButton, 'Add new address button')
	await fillVisible(modalAddressField, UPDATED_ADDRESS, 'Checkout address field')
	await chooseAutocompleteSuggestion(page)
	await clickVisible(modalAddressSaveButton, 'Save updated address button')
	await expectTextContains(displayedAddress, '2919 S La Cienega Blvd', 'Updated checkout address')

	await waitForVisible(deliverySection, 'Delivery appointment section')
	await page.locator('#date_type').selectOption({ index: 1 })
	await page.waitForTimeout(750)
	await page.locator('#time_type').selectOption({ index: 1 })
	await saveCheckoutSection(deliverySection, 'Save delivery appointment button')
	await waitForVisible(page.locator('#render_appt_summary'), 'Delivery appointment summary')

	let savedPhone = ''
	for (let attempt = 0; attempt < 5; attempt++) {
		savedPhone = buildPhoneNumber()
		await fillVisible(page.locator('#fasd_phone'), savedPhone, 'Checkout phone field')
		await fillVisible(page.locator('#fasd_dob'), '01/01/1990', 'Checkout DOB field')
		await fillVisible(page.locator('#fasd_fname'), `Artillery${attempt}`, 'Checkout first name field')
		await fillVisible(page.locator('#fasd_lname'), `LiveRec${attempt}`, 'Checkout last name field')
		await page.click('body')
		await saveCheckoutSection(yourInfoSection, 'Save personal info button')
		await page.waitForTimeout(1500)

		const phoneError = page.locator('#fasd_phone_error:has-text("Already in use")')
		if (!(await phoneError.isVisible())) {
			break
		}

		if (attempt === 4) {
			throw new Error('Unable to save a unique checkout phone number after 5 attempts.')
		}
	}

	await expectPhoneMatches(page.locator('p.--reactive-user-phone'), savedPhone, 'Saved checkout phone summary')

	await waitForVisible(documentsSection, 'Photo ID section')
	await page.locator('input#fasd_doc').setInputFiles('CA-DL.jpg')
	await fillVisible(page.locator('input#doc_exp'), buildIdExpiration(1), 'Photo ID expiration field')
	await page.click('body')
	await saveCheckoutSection(documentsSection, 'Save photo ID button')
	await expectTextContains(
		page.locator('.wpse-document-meta p').first(),
		'Exp:',
		'Saved photo ID summary',
	)

	await waitForVisible(paymentSection, 'Payment section')
	await clickVisible(page.locator('label[for="cash"]'), 'Cash payment option')
	await saveCheckoutSection(paymentSection, 'Save payment button')
	await expectTextContains(page.locator('p.--reactive-pymnt'), 'Cash', 'Saved payment summary')

	await waitForVisible(orderReviewSection, 'Order review section')
	await waitForVisible(checkoutPasswordField, 'Checkout password field')
	await waitForVisible(placeOrderButton, 'Place order button')
}

async function liveDevRecSmoke(page, vuContext, events, test) {
	const { step } = test
	const target = getTarget(vuContext)

	await step('Open live-dev homepage', async () => {
		await openHomepage(page, target)
	})

	await step('Enter delivery address', async () => {
		await enterAddress(page, DEFAULT_ADDRESS)
	})

	await step('Trigger auth with one cart item', async () => {
		await addInitialProductToTriggerAuth(page)
	})

	await step('Register a unique recreational user', async () => {
		await registerUniqueUser(page, vuContext)
	})

	await step('Return to the main shop page', async () => {
		await returnToShop(page)
	})

	await step('Add products until the delivery minimum is met', async () => {
		await addProductsUntilMinimumMet(page)
	})

	await step('Complete the pre-order checkout flow', async () => {
		await completeCheckoutFlow(page)
	})

	await step('Stop before placing the order', async () => {
		console.log('[artillery-live-dev] Checkout reached successfully; order was not placed.')
	})
}

module.exports = {
	liveDevRecSmoke,
}
