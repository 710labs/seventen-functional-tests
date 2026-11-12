const ADD_TO_CART_SELECTOR = [
	'a[aria-label*="Add to cart:"]',
	'a.add_to_cart_button',
	'button.add_to_cart_button',
	'button.fasd_to_cart',
	'[data-product_sku].fasd_to_cart',
	'[data-product_sku].add_to_cart_button',
].join(', ')
const CART_NOTICES = [
	'.woocommerce-error:visible',
	'.wc-block-components-notice-banner:visible',
	'.wpse-snacktoast:visible',
	'[role="alert"]:visible',
].join(', ')
const STOCK_REJECTION = /sold out|out of stock|insufficient stock|not enough (?:stock|available)|only\s+\d+.*\bleft|no longer available/i
const CART_LINKS = 'a.cart-contents:visible, .wpse-cart-count:visible, .cart-count:visible, a[href*="/cart/"]:visible'

function productCard(page, id) {
	return page.locator(
		`li.product.post-${id}, li.product:has([data-product_id="${id}"]), li.product:has(button.fasd_to_cart[data-id="${id}"])`,
	).filter({ visible: true }).first()
}

function productAddButton(card) {
	return card.locator(ADD_TO_CART_SELECTOR).filter({ visible: true }).first()
}

function count(events, metric) {
	events?.emit('counter', metric, 1)
}

async function cartCount(page) {
	return page.locator(CART_LINKS).evaluateAll(links => {
		for (const link of links) {
			const text = link.textContent.trim()
			const quantity = link.getAttribute('data-cart-count') ?? link.getAttribute('data-count') ??
				/\((\d+)\)|\b(?:cart|bag)\s*:?\s*(\d+)|^(\d+)\s*(?:items?)?$/i.exec(text)?.slice(1).find(Boolean)
			if (quantity && /^\d+$/.test(quantity)) return Number(quantity)
		}
		return null
	})
}

async function closeCartDrawer(page) {
	const drawer = page.locator('#cartDrawer')
	if (!(await drawer.isVisible())) return
	const close = drawer.locator('.wcse-element-closer, .wpse-button-close, button[aria-label="Close"]').filter({ visible: true }).first()
	if (await close.isVisible()) {
		await close.click({ timeout: 3000 })
	} else {
		await page.locator('a.wpse-cart-openerize:visible').first().click({ timeout: 3000 })
	}
	await drawer.waitFor({ state: 'hidden', timeout: 5000 })
}

async function productIsInCart(page, id) {
	// This is a fresh cart page in the same authenticated session. Use it to
	// resolve ambiguous clicks without ever submitting the same add again.
	const cart = await page.context().newPage()
	try {
		await cart.goto(new URL('/cart/', page.url()).href, { waitUntil: 'domcontentloaded', timeout: 15000 })
		const rows = cart.locator('.cart_item, .woocommerce-cart-form__cart-item')
		const empty = cart.getByText(/cart is currently empty|your cart is empty/i).first()
		await rows.first().or(empty).first().waitFor({ state: 'visible', timeout: 5000 })
		return (await rows.filter({ has: cart.locator(`[data-product_id="${id}"]`) }).count()) > 0
	} finally {
		await cart.close()
	}
}

async function tryAddProduct(page, id, button, facility) {
	const [buttonFacility, method] = await Promise.all([
		button.getAttribute('data-facility', { timeout: 1000 }).catch(() => null),
		button.getAttribute('data-method', { timeout: 1000 }).catch(() => null),
	])
	if (facility && ((buttonFacility && facility !== buttonFacility) || (method && method !== 'pickup'))) {
		throw new Error(`Product ${id} belongs to ${method || 'pickup'} facility ${buttonFacility}. Expected pickup facility ${facility}.`)
	}
	const previousCount = await cartCount(page)
	const notices = page.locator(CART_NOTICES)
	const previousNotices = new Set(await notices.allTextContents())
	let clickError
	try {
		await button.click({ timeout: 5000 })
	} catch (error) {
		clickError = error
	}

	const drawerProduct = page.locator(`#cartDrawer .cart_item:has([data-product_id="${id}"])`)
	const deadline = Date.now() + 10000
	let rejected = false
	do {
		const currentCount = await cartCount(page)
		if (await drawerProduct.first().isVisible() ||
			(previousCount !== null && currentCount !== null && currentCount > previousCount)) {
			await closeCartDrawer(page)
			return 'added'
		}
		rejected = (await notices.allTextContents()).some(notice =>
			!previousNotices.has(notice) && STOCK_REJECTION.test(notice))
		if (rejected || clickError) break
		await page.waitForTimeout(250)
	} while (Date.now() < deadline)

	if (await productIsInCart(page, id)) {
		await closeCartDrawer(page)
		return 'added'
	}
	await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 })
	const card = productCard(page, id)
	if (rejected || await card.locator('.sold-out-badge:visible, .waitlist-button:visible').count() ||
		await card.evaluate(element => element.classList.contains('outofstock'), undefined, { timeout: 1000 }).catch(() => false)) {
		return 'sold_out'
	}
	throw new Error(`Add to cart for product ${id} had no confirmed result.`, { cause: clickError })
}

async function addCheckoutProducts(page, ids, itemCount, usageType, events, facility) {
	await page.locator('li.product:visible').first().waitFor({ timeout: 30000 })
	let added = 0
	let stockRejections = 0
	for (const id of ids) {
		const card = productCard(page, id)
		const button = productAddButton(card)
		if (usageType === 'Recreational' && await card.locator('.medOnly').count()) continue
		if (!(await button.isVisible()) || !(await button.isEnabled())) continue
		if (await tryAddProduct(page, id, button, facility) === 'sold_out') {
			count(events, 'checkout.stock_rejections')
			stockRejections += 1
			continue
		}
		added += 1
		if (added === itemCount) {
			if (stockRejections) events?.emit('counter', 'checkout.stock_recoveries', stockRejections)
			return
		}
	}
	throw new Error(`Checkout added ${added}/${itemCount} items. The configured checkout pool has no eligible alternatives.`)
}

module.exports = { ADD_TO_CART_SELECTOR, addCheckoutProducts, count, productAddButton, productCard, tryAddProduct }
