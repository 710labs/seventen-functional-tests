import { expect as baseExpect, type Page, type Locator } from '@playwright/test'
import { LiveNonProdCartFlow } from '../../models/always-on/live-nonprod-cart-flow'
import { selectFirstAvailableDeliFlowerPortion, getVisibleInsufficientInventoryNotice } from '../../models/always-on/product-portions'
import { selectAutocompleteAddress } from '../../support/qa/address-autocomplete'
import path from 'node:path'
import { randomInt } from 'node:crypto'

const { assertLiveTarget, boolean, buildUser } = require('./live-settings')
const expect = baseExpect.configure({ timeout: 30000 })
const address = '440 Rodeo Drive Beverly Hills'
const authSelector = 'section.wpse-component #renderGateway'
const fixture = (name: string) => path.resolve(__dirname, '../fixtures', name)
const directStep = async <T>(_name: string, action: () => Promise<T>): Promise<T> => action()
type Events = { emit: (type: string, metric: string, value: number) => void }
type Step = typeof directStep
type User = ReturnType<typeof buildUser>

async function visible(locator: Locator) {
	for (let i = 0; i < await locator.count(); i++) {
		const candidate = locator.nth(i)
		if (await candidate.evaluate(element => {
			const r = element.getBoundingClientRect()
			return r.width > 0 && r.height > 0 && r.left < innerWidth && r.right > 0 && r.top < innerHeight && r.bottom > 0
		}).catch(() => false)) return candidate
	}
	throw new Error('LIVE_CONTROL_NOT_VISIBLE')
}

async function enterAddress(page: Page) {
	await (await visible(page.locator('a.wpse-button-storenav.wpse-openerize'))).click()
	const drawer = page.locator('div.wpse-drawer[data-module="fulfillment"]')
	await expect(drawer).toBeVisible()
	const field = drawer.locator('#fasd_address')
	if (!(await field.isVisible())) await drawer.locator('label:has-text("Add new address")').click()
	await selectAutocompleteAddress(page, field, address, 15000, directStep)
	const submit = drawer.locator('button.wpse-button-primary.fasd-form-submit').first()
	await expect(submit).toBeEnabled()
	await submit.click()
	await expect(page.locator('li.product.type-product').first()).toBeVisible({ timeout: 30000 })
}

async function productLinks(page: Page) {
	return page.locator('li.product.type-product').evaluateAll(products => products
		.filter(product => !product.querySelector('.wpse-metabadge.med-metabadge'))
		.map(product => product.querySelector<HTMLAnchorElement>('.woocommerce-loop-product__link')?.href)
		.filter((href): href is string => Boolean(href)))
}

async function openProduct(page: Page, href: string) {
	await page.goto(href, { waitUntil: 'domcontentloaded' })
	const button = page.locator('.summary.entry-summary').getByRole('button', { name: /^add to cart$/i }).first()
	await expect(button).toBeVisible()
	await selectFirstAvailableDeliFlowerPortion(page, button, 'Live load-test product')
	await expect(button).toBeEnabled()
	return button
}

async function register(page: Page, user: User, password: string) {
	const modal = page.locator(authSelector)
	await expect(modal).toBeVisible()
	await modal.locator('#fasd_email').fill(user.email)
	await modal.getByRole('button', { name: 'Continue', exact: true }).click()
	await modal.locator('#password').fill(password)
	await modal.locator('#reg_fname').fill(user.firstName)
	await modal.locator('#reg_lname').fill(user.lastName)
	const zip = modal.locator('#reg_postcode')
	if (await zip.isVisible()) await zip.fill('90210')
	await modal.locator('#reg_dob').fill(user.dob)
	await modal.getByRole('button', { name: 'Create Account', exact: true }).click()
	await expect(modal).toBeHidden({ timeout: 30000 })
}

async function hasCartItems(page: Page) {
	if (await page.locator('#cartDrawer .cart_item').count() > 0) return true
	return page.locator('a.wpse-cart-openerize').evaluateAll(toggles => toggles.some(toggle => {
		const values = ['data-count', 'data-cart-count', 'data-item-count'].map(key => toggle.getAttribute(key))
		values.push(toggle.textContent, toggle.getAttribute('aria-label'), toggle.getAttribute('title'))
		return values.some(value => /\b[1-9]\d*\b/.test(value || ''))
	}))
}

async function seedCart(page: Page, links: string[]) {
	// Registration may already add the selected item. Do not add it twice.
	if (await hasCartItems(page)) return
	for (const href of links.slice(0, 8)) {
		const button = await openProduct(page, href)
		await button.click()
		const outcome = await expect.poll(async () => {
			if (await hasCartItems(page)) return 'added'
			if (await getVisibleInsufficientInventoryNotice(page)) return 'unavailable'
			return ''
		}, { timeout: 20000 }).not.toBe('').then(async () => hasCartItems(page))
		if (outcome) return
	}
	throw new Error('LIVE_REGISTRATION_CART_UNAVAILABLE')
}

async function selectOption(select: Locator) {
	await expect(select).toBeVisible()
	const options = () => select.locator('option').evaluateAll(elements => elements
		.filter(option => !(option as HTMLOptionElement).disabled && (option as HTMLOptionElement).value && !/^select\b|choose\b/i.test(option.textContent || ''))
		.map(option => ({ value: (option as HTMLOptionElement).value, label: (option.textContent || '').trim() })))
	await expect.poll(async () => (await options()).length, { timeout: 15000 }).toBeGreaterThan(0)
	const choices = await options()
	const choice = choices[randomInt(choices.length)]
	await select.selectOption(choice.value)
	await expect(select).toHaveValue(choice.value)
	return choice
}

async function checkout(page: Page, user: User, medical: boolean, step: Step) {
	await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible()
	const pickup = await page.getByRole('heading', { name: 'Pickup Location', exact: true }).isVisible()
	const save = page.locator('a.wpse-button-primary.fasd-form-submit')
	await step('appointment', async () => {
		if (pickup) return
		await expect(page.locator('p.--reactive-long-origin').first()).toContainText(/Rodeo/i)
		const dayField = page.locator('#date_type')
		const timeField = page.locator('#time_type')
		const day = await selectOption(dayField)
		// The day change refreshes the available times asynchronously.
		await page.waitForTimeout(1000)
		const time = await selectOption(timeField)
		await save.nth(0).click()
		await expect(page.locator('#render_appt_summary')).toContainText(time.label)
		await expect(dayField).toHaveValue(day.value)
	})
	await step('personal_info', async () => {
		await page.locator('#fasd_phone').fill(user.phone)
		await page.locator('#fasd_dob').fill(user.dob)
		await page.locator('#fasd_dob').press('Tab')
		await save.nth(pickup ? 0 : 1).click()
		await expect(page.locator('.--reactive-user-phone').first()).toContainText(user.phone.slice(-4))
		await expect(page.locator('p.--reactive-user-dob')).toHaveText('01/01/1990')
	})
	await step('photo_id', async () => {
		const year = new Date().getFullYear() + 1
		await page.locator('#fasd_doc').setInputFiles(fixture('CA-DL.jpg'))
		await page.locator('#doc_exp').fill(`${year}-04-10`)
		await page.locator('#doc_exp').press('Tab')
		await save.nth(pickup ? 1 : 2).click()
		await expect(page.locator('div.wpse-document-meta p').first()).toContainText(`04/10/${year}`)
		if (medical) await expect(page.locator('div.wpse-document-meta p').nth(1)).toContainText('Exp:')
	})
	await step('payment', async () => {
		await page.locator('label[for="cash"]').click()
		await save.nth(pickup ? 2 : 3).click()
		await expect(page.locator('p.--reactive-pymnt')).toHaveText('Cash')
	})
	await step('checkout_ready', async () => {
		await expect(page.locator('#checkout_checkout')).toBeVisible()
		await page.locator('#dev_pswrd').fill(process.env.CHECKOUT_PASSWORD!)
		await page.locator('a.wpse-button-primary.fasd-form-submit').filter({ hasText: /^Submit$/ }).click()
		await expect(page.locator('#place_order')).toBeVisible()
		await expect(page.locator('#place_order')).toBeEnabled({ timeout: 30000 })
	})
}

async function openAccount(page: Page, target: string) {
	await page.goto(`${target}/my-account/`, { waitUntil: 'domcontentloaded' })
	await expect(page.getByRole('link', { name: 'Sign out', exact: true })).toBeVisible()
}

async function editDocument(page: Page, medical: boolean) {
	const year = new Date().getFullYear() + 1
	const module = medical ? 'meddoc' : 'iddoc'
	await page.locator(`a.specific-link[data-module="${module}"]`).first().click()
	const heading = medical ? 'Replace your med card on file' : 'Replace your ID on file'
	const drawer = page.locator('.wpse-drawer').filter({ has: page.getByRole('heading', { name: heading, exact: true }) })
	await expect(drawer).toBeVisible()
	await drawer.locator(medical ? '#fasd_medcard' : '#fasd_doc').setInputFiles(fixture(medical ? 'Medical-Card.png' : 'CA-DL.jpg'))
	await drawer.locator(medical ? '#medcard_exp' : '#doc_exp').fill(`${year}-04-10`)
	if (medical) {
		await drawer.locator('#medcard_state').selectOption('CA')
		await drawer.locator('#medcard_no').fill(String(randomInt(10000000, 100000000)))
	}
	await drawer.locator('a.wpse-button-primary.fasd-form-submit').click()
	await expect(drawer).not.toBeInViewport()
	const summary = page.locator(medical ? '#render_medcard_summary' : 'div.wpse-account-component:has(h3:has-text("Photo ID"))')
	await expect(summary).toContainText(`04/10/${year}`)
}

async function account(page: Page, target: string, user: User, medical: boolean, password: string, step: Step) {
	await step('account_open', () => openAccount(page, target))
	await step('account_personal', async () => {
		await page.locator('a.specific-link[data-module="personal"]').click()
		const drawer = page.locator('.wpse-drawer').filter({ has: page.getByRole('heading', { name: 'Your information', exact: true }) })
		await expect(drawer).toBeVisible()
		await drawer.locator('#fasd_fname').fill('Updated Loadtest')
		await drawer.locator('#fasd_lname').fill(user.lastName)
		await drawer.locator('#fasd_email').fill(user.updatedEmail)
		await drawer.locator('#fasd_phone').fill(user.phone)
		await drawer.locator('#fasd_dob').first().fill(user.dob)
		await drawer.locator('a.wpse-button-primary.fasd-form-submit').first().click()
		await expect(page.locator('p.--reactive-user-email')).toHaveText(user.updatedEmail)
		await page.reload({ waitUntil: 'domcontentloaded' })
		await expect(page.locator('p.--reactive-user-email')).toHaveText(user.updatedEmail)
		await expect(page.locator('span.--reactive-user-fname')).toHaveText('Updated Loadtest')
	})
	await step('account_photo_id', () => editDocument(page, false))
	if (medical) await step('account_medical_card', () => editDocument(page, true))
	const newPassword = process.env.NEW_ALWAYS_ON_PASSWORD!
	await step('account_password', async () => {
		await page.locator('a.specific-link[data-module="password"]').click()
		await page.locator('#old_password').fill(password)
		await page.locator('#new_password').fill(newPassword)
		await page.locator('button.wpse-button-secondary.fasd-form-submit').click()
		await expect(page.getByRole('heading', { name: 'Change password', exact: true })).not.toBeInViewport()
	})
	await step('logout', async () => {
		await openAccount(page, target)
		await page.getByRole('link', { name: 'Sign out', exact: true }).click()
		await page.waitForLoadState('domcontentloaded')
		if (page.url().includes('wp-login.php')) {
			await page.getByRole('link', { name: /log out/i }).click()
		}
		await expect(page.getByRole('link', { name: 'Sign out', exact: true })).toBeHidden()
	})
	await step('login', async () => {
		await page.goto(target, { waitUntil: 'domcontentloaded' })
		await enterAddress(page)
		const links = await productLinks(page)
		if (!links.length) throw new Error('LIVE_INVENTORY_UNAVAILABLE')
		await (await openProduct(page, links[0])).click()
		const modal = page.locator(authSelector)
		await expect(modal).toBeVisible()
		await modal.locator('#fasd_email').fill(user.updatedEmail)
		await modal.getByRole('button', { name: 'Continue', exact: true }).click()
		await modal.locator('#password').fill(newPassword)
		await modal.getByRole('button', { name: 'Sign in', exact: true }).click()
		await expect(modal).toBeHidden({ timeout: 30000 })
		await openAccount(page, target)
		await expect(page.locator('p.--reactive-user-email')).toHaveText(user.updatedEmail)
	})
}

export async function finishLiveOrder(page: Page, placeOrders: boolean, record: (orderId: string) => void) {
	if (!placeOrders) return
	// Submit once; a confirmation timeout must never create a duplicate order.
	await page.locator('#place_order').click()
	const confirmation = page.locator('p.thankyou-number a')
	await confirmation.waitFor({ state: 'visible', timeout: 60000 })
	const orderId = (await confirmation.innerText()).replace(/^#/, '').trim()
	if (!/^\d+$/.test(orderId)) throw new Error('LIVE_ORDER_ID_INVALID')
	record(orderId)
}

export async function runLive(page: Page, context: any, events: Events, test: { step?: Step }, scenario: string) {
	const target = assertLiveTarget(process.env.ARTILLERY_TARGET || context.vars?.target)
	assertLiveTarget(context.config?.target || target)
	const isOrder = scenario.endsWith('-order')
	const medical = scenario.startsWith('med-')
	const placeOrders = boolean(context.vars?.livePlaceOrders ?? process.env.PLACE_ORDERS)
	const password = process.env.ALWAYS_ON_PASSWORD
	if (!password || !process.env.RECAPTCHA_BYPASS || (isOrder && !process.env.CHECKOUT_PASSWORD) || (!isOrder && !process.env.NEW_ALWAYS_ON_PASSWORD)) {
		throw new Error('LIVE_REQUIRED_SECRET_MISSING')
	}
	if (!isOrder && password === process.env.NEW_ALWAYS_ON_PASSWORD) throw new Error('LIVE_PASSWORDS_MUST_DIFFER')
	const runId = process.env.LIVE_RUN_ID || 'local'
	const user = buildUser(runId)
	let stage = 'setup'
	const step: Step = async (name, action) => {
		stage = name
		const started = Date.now()
		let result: any
		try {
			await (test?.step || directStep)(`live.${scenario}.${name}`, async () => { result = await action() })
			events.emit('counter', `live.${scenario}.${name}.completed`, 1)
			return result
		} finally {
			events.emit('histogram', `live.${scenario}.${name}.ms`, Date.now() - started)
		}
	}
	page.setDefaultTimeout(30000)
	page.setDefaultNavigationTimeout(45000)
	// Block accidental first-party navigation out of dev even if the site redirects.
	await page.route('**/*', async route => {
		const request = route.request()
		if (request.isNavigationRequest() && request.frame() === page.mainFrame() && new URL(request.url()).origin !== target) {
			await route.abort('blockedbyclient')
		} else await route.fallback()
	})
	await page.context().addCookies([{
		name: 'qa_wf_captcha_bypass', value: process.env.RECAPTCHA_BYPASS!,
		domain: new URL(target).hostname, path: '/', secure: true, sameSite: 'Lax',
	}])
	events.emit('counter', `live.${scenario}.attempted`, 1)
	let deadline: ReturnType<typeof setTimeout> | undefined
	try {
		await Promise.race([
			(async () => {
				await step('storefront', async () => {
					await page.goto(target, { waitUntil: 'domcontentloaded' })
					await expect(page.locator('span.site-header-group')).toBeVisible()
				})
				await step('address', () => enterAddress(page))
				const links = await productLinks(page)
				if (!links.length) throw new Error('LIVE_INVENTORY_UNAVAILABLE')
				await step('registration', async () => {
					await (await openProduct(page, links[0])).click()
					await register(page, user, password)
				})
				if (isOrder) {
					await step('cart', async () => {
						await seedCart(page, links)
						await page.goto(target, { waitUntil: 'domcontentloaded' })
						const cart = new LiveNonProdCartFlow(page, {
							step: directStep, medicalCardPath: fixture('Medical-Card.png'), requireMedicalProduct: medical,
						})
						const result = await cart.addProductsUntilCheckout(medical ? 'med' : 'rec')
						if (medical && !result.medicalProductAdded) throw new Error('LIVE_MEDICAL_INVENTORY_UNAVAILABLE')
					})
					await checkout(page, user, medical, step)
					if (placeOrders) await step('order', () => finishLiveOrder(page, placeOrders, orderId => {
						// Fargate persists worker stdout to its run's S3 worker-log files.
						console.log(`LIVE_ORDER ${JSON.stringify({ runId, vuId: user.id, scenario, orderId })}`)
						events.emit('counter', 'live.orders_confirmed', 1)
					}))
				} else await account(page, target, user, medical, password, step)
				events.emit('counter', `live.${scenario}.completed`, 1)
			})(),
			new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('LIVE_JOURNEY_TIMEOUT')), 600000) }),
		])
	} catch (error) {
		events.emit('counter', `live.${scenario}.${stage}.failed`, 1)
		events.emit('counter', `live.${scenario}.failed`, 1)
		// Stable codes keep identities, DOM snapshots, and credentials out of reports.
		const code = error instanceof Error && /^LIVE_[A-Z_]+$/.test(error.message) ? error.message : `LIVE_${stage.toUpperCase()}_FAILED`
		throw new Error(code)
	} finally {
		clearTimeout(deadline)
		await page.close().catch(() => {})
	}
}

export const liveRecOrder = (page, context, events, test) => runLive(page, context, events, test, 'rec-order')
export const liveMedOrder = (page, context, events, test) => runLive(page, context, events, test, 'med-order')
export const liveRecAccount = (page, context, events, test) => runLive(page, context, events, test, 'rec-account')
export const liveMedAccount = (page, context, events, test) => runLive(page, context, events, test, 'med-account')
