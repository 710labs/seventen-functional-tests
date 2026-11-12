const { ADD_TO_CART_SELECTOR, count, productAddButton, productCard, tryAddProduct } = require('./drop-cart')
const { integer } = require('./waitlist-settings')

const INVENTORY_WAIT_MS = 180000
const WAITLIST_UPDATE_MS = 30000
const JOIN_WAITLIST = /^join waitlist$/i

function joinButton(card, id) {
	return card.locator(`button.waitlist-button[data-product_id="${id}"]`)
		.and(card.getByRole('button', { name: JOIN_WAITLIST }))
		.filter({ visible: true })
		.first()
}

async function sampleProduct(card, id) {
	const { raw, waitlistVisible, soldOut } = await card.evaluate((element, productId) => {
		const button = element.querySelector(`button.waitlist-button[data-product_id="${productId}"]`)
		const badge = element.querySelector('.sold-out-badge')
		const visible = node => Boolean(node?.getClientRects().length && getComputedStyle(node).visibility === 'visible')
		return {
			raw: element.querySelector('[data-gtm4wp_product_data]')?.getAttribute('data-gtm4wp_product_data'),
			waitlistVisible: visible(button),
			soldOut: element.classList.contains('outofstock') || visible(badge),
		}
	}, id, { timeout: 10000 })
	if (!raw) throw new Error(`Product ${id} has no storefront stock metadata.`)
	const data = JSON.parse(raw)
	if (String(data?.internal_id ?? data?.item_id ?? data?.id) !== id || data?.stocklevel == null) {
		throw new Error(`Product ${id} has no matching numeric storefront stock sample.`)
	}
	return { stock: integer(data.stocklevel, `Available stock for product ${id}`, 0), waitlistVisible, soldOut }
}

async function joinWaitlist(page, card, button, id, facility, events) {
	await button.click({ timeout: 10000 })
	const modal = page.locator('#waitlistElement')
	const submit = modal.locator('#waitlistSubmit')
	await submit.waitFor({ state: 'visible', timeout: 15000 })

	for (const [field, expected] of Object.entries({
		product_id: id,
		method: 'pickup',
		facility_id: facility,
	})) {
		const actual = await modal.locator(`#waitlist_${field}`).inputValue({ timeout: 5000 })
		if (actual !== expected) throw new Error(`Waitlist product ${id} has unexpected ${field} "${actual}". Expected "${expected}".`)
	}

	const startedAt = Date.now()
	let clickError
	try {
		await submit.click({ timeout: 10000 })
	} catch (error) {
		clickError = error
	}
	const confirmation = card.locator(`button.waitlist-button.on-waitlist[data-product_id="${id}"][aria-disabled="true"]`)
		.filter({ hasText: /^\s*On waitlist\s*$/i, visible: true })
	const error = modal.locator('#waitlist_error:visible').filter({ hasText: /\S/ })
	try {
		await confirmation.or(error).first().waitFor({ state: 'visible', timeout: 30000 })
	} catch {
		count(events, 'waitlist.confirmation_timeout')
		throw new Error(`Waitlist confirmation timed out for product ${id}.`, { cause: clickError })
	}
	if (await error.isVisible()) {
		count(events, 'waitlist.submission_errors')
		throw new Error(`Waitlist submission rejected for product ${id}.`)
	}
	count(events, 'waitlist.confirmed')
	events?.emit('histogram', 'waitlist.submit_to_confirmation_ms', Date.now() - startedAt)
}

async function catalogProductIds(page, events) {
	const cards = page.locator('li.product:visible')
	await cards.first().waitFor({ timeout: 30000 })
	const cartControls = page.locator(`${ADD_TO_CART_SELECTOR}, .single_add_to_cart_button, form.cart [name="add-to-cart"]`)
		.or(page.getByRole('button', { name: /add to cart/i }))
		.or(page.getByRole('link', { name: /add to cart/i }))
		.filter({ visible: true })
	if (await cartControls.count()) {
		count(events, 'waitlist.catalog_cart_controls_visible')
		throw new Error('The waitlist-only storefront shows an Add to cart control.')
	}

	const entries = await cards.evaluateAll(elements => elements.map(card => ({
		name: card.querySelector('.woocommerce-loop-product__title')?.textContent?.trim() || card.className,
		id: Array.from(card.querySelectorAll('button.waitlist-button[data-product_id]')).find(button =>
			button.getClientRects().length && getComputedStyle(button).visibility === 'visible' &&
			!button.matches(':disabled') && !button.closest('[aria-disabled="true"]') &&
			/^join waitlist$/i.test((button.getAttribute('aria-label') || button.textContent).trim()),
		)?.getAttribute('data-product_id'),
	})))
	for (const { id, name } of entries) {
		if (!id || !/^[1-9]\d*$/.test(id)) {
			count(events, 'waitlist.catalog_join_missing')
			throw new Error(`Catalog product "${name}" has no enabled Join Waitlist button.`)
		}
	}
	return entries.map(({ id }) => id)
}

async function runWaitlistCatalog(page, events, facility) {
	const fulfillmentModal = page.locator('#fulfillmentElement').filter({ hasText: /how do you want your order/i })
	await fulfillmentModal.waitFor({ state: 'hidden', timeout: 15000 })
	const origin = new URL(page.url()).origin
	const pages = new Map()
	const seen = new Set()

	// Validate every catalog page before making the first signup.
	while (true) {
		const url = page.url()
		if (pages.has(url)) throw new Error('Storefront catalog pagination returned to an already checked page.')
		const ids = new Set(await catalogProductIds(page, events))
		pages.set(url, [...ids].filter(id => !seen.has(id)))
		for (const id of ids) seen.add(id)
		const next = page.locator('.woocommerce-pagination a.next:visible, .woocommerce-pagination a[rel~="next"]:visible').first()
		if (!(await next.isVisible())) break
		const href = await next.evaluate(link => link.href)
		if (new URL(href).origin !== origin) throw new Error('Storefront catalog pagination left the target site.')
		await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 15000 })
	}
	events?.emit('counter', 'waitlist.catalog_products_checked', seen.size)

	const modal = page.locator('#waitlistElement')
	const close = modal.getByRole('button', { name: 'Close', exact: true })
	for (const [url, ids] of pages) {
		if (page.url() !== url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
		for (const id of ids) {
			const card = productCard(page, id)
			await joinWaitlist(page, card, joinButton(card, id), id, facility, events)
			if (await close.isVisible()) {
				await close.click({ timeout: 3000 }).catch(async error => {
					if (await modal.isVisible()) throw error
				})
			}
			await modal.waitFor({ state: 'hidden', timeout: 10000 })
		}
	}
	count(events, 'waitlist.catalog_completed')
}

async function runWaitlist(page, events, env = process.env) {
	const facility = String(integer(env.ARTILLERY_WAITLIST_FACILITY_ID, 'Waitlist pickup facility ID'))
	if (env.ARTILLERY_WAITLIST_CATALOG === 'true') {
		return runWaitlistCatalog(page, events, facility)
	}

	const id = String(integer(env.ARTILLERY_WAITLIST_PRODUCT_ID, 'Waitlist product ID'))
	const seed = integer(env.ARTILLERY_WAITLIST_STARTING_STOCK, 'Waitlist starting stock', 0)
	const card = productCard(page, id)
	await card.waitFor({ state: 'visible', timeout: 30000 })
	const join = joinButton(card, id)
	const deadline = Date.now() + INVENTORY_WAIT_MS
	let firstZeroAt = null
	let rejected = false

	do {
		const { stock, waitlistVisible, soldOut } = await sampleProduct(card, id)
		if (stock > seed) throw new Error(`Product ${id} has ${stock} available. Expected at most its seeded stock of ${seed}.`)
		if (stock > 0) {
			firstZeroAt = null
			if (waitlistVisible) {
				count(events, 'waitlist.appeared_before_zero')
				throw new Error(`Product ${id} shows a waitlist with ${stock} units available.`)
			}
			const add = productAddButton(card)
			if (await add.isVisible() && await add.isEnabled() && !rejected) {
				if (stock === seed) count(events, 'waitlist.seed_observed')
				if (await tryAddProduct(page, id, add, facility) === 'added') {
					count(events, 'waitlist.cart_holds')
					return
				}
				count(events, 'waitlist.stock_rejections')
				rejected = true
				// The cart helper refreshed the page after reconciling the click.
				continue
			}
		} else {
			if (firstZeroAt === null) {
				firstZeroAt = Date.now()
				count(events, 'waitlist.zero_observed')
			}
			if (Date.now() - firstZeroAt >= WAITLIST_UPDATE_MS) break
			if (soldOut && waitlistVisible && await join.isEnabled()) {
				events?.emit('histogram', 'waitlist.zero_to_button_ms', Date.now() - firstZeroAt)
				await joinWaitlist(page, card, join, id, facility, events)
				if (rejected) count(events, 'waitlist.stock_recoveries')
				return
			}
		}
		await page.waitForTimeout(2000 + Math.random() * 500)
		await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
	} while (Date.now() < deadline)

	if (firstZeroAt !== null) {
		count(events, 'waitlist.button_missing_at_zero')
		throw new Error(`Product ${id} reached zero without showing an enabled Join Waitlist button.`)
	}
	count(events, 'waitlist.zero_not_observed')
	throw new Error(`Product ${id} did not reach zero available stock within ${INVENTORY_WAIT_MS / 1000}s.`)
}

module.exports = { runWaitlist }
