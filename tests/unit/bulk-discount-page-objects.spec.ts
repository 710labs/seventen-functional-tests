import { test, expect } from '@playwright/test'
import { CartPage } from '../../models/cart-page'
import { CheckoutPage } from '../../models/checkout-page'
import { ShopPage } from '../../models/shop-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'
import { moneyInCents } from '../../models/components/order-pricing'
import { shopOffersMarkup, suppliedSummaryMarkup, productTagsMarkup } from './fixtures/bulk-discount-markup'

const { expectedCart } = require('../../support/bulk-discounts/oracle.cjs')
const expected = expectedCart([{ productId: 101, categoryIds: [331], qty: 3, unitPrice: '39.00', isFreeBogoUnit: false }])
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
const amount = (cents: number) => `<span class="amount">${dollars(cents)}</span>`

test('storefront becomes usable while a background request remains pending', async ({ browser }, info) => {
	test.setTimeout(10000)
	const context = await browser.newContext({ baseURL: 'https://storefront.test' })
	try {
		const page = await context.newPage()
		await page.route('https://storefront.test/', route => route.fulfill({ contentType: 'text/html', body:
			'<button class="wcse-nav">Pickup</button><ul><li class="product"><button class="add_to_cart_button">Add</button></li></ul><script>fetch("/background")</script>' }))
		await page.route('https://storefront.test/background', () => {})
		await new ShopPage(page, 'chromium', info).openStorefrontForFulfillment('Pickup')
		await expect(page.locator('li.product')).toBeVisible()
		await expect(page.waitForLoadState('networkidle', { timeout: 750 })).rejects.toThrow('Timeout')
	} finally {
		await context.close()
	}
})

function summaryRows(pricing = expected, removeLink = false, cart = true) {
	return `<tr class="cart-subtotal"><th>Subtotal</th><td>${amount(pricing.subtotal)}</td></tr>
		${cart && pricing.discountLines.some(line => line.categoryId) ? '<tr class="svntn-wdr-section"><th colspan="2">List member pricing</th></tr>' : ''}
		${pricing.discountLines.map(line => `<tr class="cart-discount${cart && line.categoryId ? ' svntn-wdr-row' : ''}"><th>${line.label}</th><td>-${amount(line.amount)}${removeLink ? '<a class="woocommerce-remove-coupon">[Remove]</a>' : ''}</td></tr>`).join('')}
		${['gross', 'excise', 'sales'].map(key => `<tr class="tax-rate"><th>${key}</th><td>${amount(pricing[key])}</td></tr>`).join('')}
		<tr class="order-total"><th>Total</th><td>${amount(pricing.total)}</td></tr>`
}

test('cart and checkout share the same discount assertion even with legacy tax bypass', async ({ page }, info) => {
	const original = process.env.BYPASS_TAX_CALC
	process.env.BYPASS_TAX_CALC = 'true'
	try {
		await page.setContent(`<div class="cart_totals"><table>${summaryRows()}</table></div><table class="woocommerce-checkout-review-order-table">${summaryRows(expected, false, false)}</table>`)
		await new CartPage(page, null!, 'chromium', info, 'recreational').verifyDiscountPricing(expected)
		await new CheckoutPage(page, null!).verifyDiscountPricing(expected)
	} finally {
		if (original === undefined) delete process.env.BYPASS_TAX_CALC
		else process.env.BYPASS_TAX_CALC = original
	}
})

test('cart and checkout verify discounted totals using the current dev pickup rates', async ({ page }, info) => {
	const rules = require('../../support/bulk-discounts/rules.json')
	const pickupTaxes = require('../../support/bulk-discounts/dev-pickup-taxes.json')
	const pricing = expectedCart([
		{ productId: 101, categoryIds: [331], qty: 3, unitPrice: '39.00', isFreeBogoUnit: false },
		{ productId: 102, categoryIds: [326], qty: 3, unitPrice: '14.00', isFreeBogoUnit: false },
	], 'plain', { ...rules, taxes: pickupTaxes.taxes, taxRounding: pickupTaxes.taxRounding })
	await page.setContent(`<div class="cart_totals"><table>${summaryRows(pricing)}</table></div><table class="woocommerce-checkout-review-order-table">${summaryRows(pricing, false, false)}</table>`)
	await new CartPage(page, null!, 'chromium', info, 'recreational').verifyDiscountPricing(pricing)
	await new CheckoutPage(page, null!).verifyDiscountPricing(pricing)
})

test('cart accepts existing coupon controls but still rejects a stale tier', async ({ page }, info) => {
	const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
	await page.setContent(`<div class="cart_totals"><table>${summaryRows(expected, true)}</table></div>`)
	await cart.verifyDiscountPricing(expected)
	await page.setContent(`<div class="cart_totals"><table>${summaryRows({ ...expected, discountLines: [{ ...expected.discountLines[0], label: 'Eighths 5+', amount: 2100 }] })}</table></div>`)
	await expect(cart.verifyDiscountPricing(expected)).rejects.toThrow()
})

test('checkout rejects taxes computed on the undiscounted amount', async ({ page }) => {
	await page.setContent(`<table class="woocommerce-checkout-review-order-table">${summaryRows({ ...expected, gross: expected.gross + 120 }, false, false)}</table>`)
	await expect(new CheckoutPage(page, null!).verifyDiscountPricing(expected)).rejects.toThrow()
})

test('quantity edits submit the shared cart form and product removal targets one row', async ({ page }, info) => {
	await page.setContent(`<form class="woocommerce-cart-form"><table><tr class="cart_item"><td class="product-remove"><a data-product_id="101" href="#">Remove</a></td><td><input class="qty" value="3"></td><td class="product-price">${amount(3900)}</td></tr></table><button name="update_cart" disabled>Update</button></form>`)
	await page.evaluate(() => {
		const button = document.querySelector<HTMLButtonElement>('button')!
		document.querySelector('input')!.addEventListener('change', () => { button.disabled = false })
		document.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); button.disabled = true; document.body.dataset.updated = 'true' })
		document.querySelector('a')!.addEventListener('click', event => { event.preventDefault(); document.querySelector('tr')!.remove() })
	})
	const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
	await cart.setProductQuantity(101, 5)
	await expect(page.locator('body')).toHaveAttribute('data-updated', 'true')
	await cart.verifyProductQuantities([{ productId: 101, qty: 5, unitPrice: '39.00' }])
	await cart.removeProduct(101)
	await cart.verifyEmpty()
})

for (const mode of ['stale-header', 'wrong-product', 'unchanged-quantity'] as const) {
	test(`selected products require the actual cart ID and quantity: ${mode}`, async ({ browser }, info) => {
		const context = await browser.newContext({ baseURL: 'https://cart-confirm.test' })
		try {
			const page = await context.newPage()
			const quantities = new Map<number, number>(mode === 'wrong-product' ? [] : [[101, 2]])
			let addRequests = 0
			await page.route('https://cart-confirm.test/**', async route => {
				const path = new URL(route.request().url()).pathname
				if (path === '/add') {
					addRequests++
					const id = mode === 'stale-header' ? 101 : 202
					quantities.set(id, (quantities.get(id) || 0) + 1)
					await route.fulfill({ json: { count: [...quantities.values()].reduce((sum, qty) => sum + qty, 0) } })
				} else if (path === '/cart/') {
					await route.fulfill({ contentType: 'text/html', body: `<h1>Cart</h1><form class="woocommerce-cart-form"><table>
						${[...quantities].map(([id, qty]) => `<tr class="cart_item"><td><a data-product_id="${id}">Same visible name</a></td><td><input class="qty" value="${qty}"></td></tr>`).join('')}
						</table></form>` })
				} else {
					await route.fulfill({ contentType: 'text/html', body: `<a href="/cart/">My Bag (${[...quantities.values()].reduce((sum, qty) => sum + qty, 0)})</a>
						<ul>${[101, 202].map(id => `<li class="product"><h2>Same visible name</h2><span class="price">$39.00</span><button class="add_to_cart_button" data-product_id="${id}" data-product_sku="sku-${id}">Add</button></li>`).join('')}</ul>
						<script>document.querySelectorAll('button').forEach(button => button.onclick = async () => {
							const result = await (await fetch('/add', { method: 'POST' })).json();
							if (${JSON.stringify(mode)} !== 'stale-header') document.querySelector('a').textContent = 'My Bag (' + result.count + ')';
						});</script>` })
				}
			})
			await page.goto('/')
			const shop = new ShopPage(page, 'chromium', info)
			const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
			const candidate = (await shop.getAddableStorefrontProducts()).find(product => product.productId === 101)!
			const selected = [{ ...candidate, productId: 101, categoryIds: [331], unitPrice: '39.00' }]
			if (mode === 'stale-header') {
				await shop.addSelectedProducts(selected, cart)
				await cart.verifyProductQuantity(101, 3)
			} else {
				await expect(shop.addSelectedProducts(selected, cart)).rejects.toThrow(
					mode === 'wrong-product' ? 'Cart must contain product ID 101' : 'toHaveValue')
			}
			expect(addRequests, 'An ambiguous UI signal must never trigger a duplicate add').toBe(1)
		} finally {
			await context.close()
		}
	})
}

test('category discovery paginates and matches only addable menu products', async ({ page }, info) => {
	const origin = 'https://bulk-catalogue.test'
	await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body:
		'<li class="product"><h2>Fixture</h2><span class="price">$39.00</span><button class="add_to_cart_button" data-product_id="101" data-product_sku="fixture">Add</button></li>' }))
	await page.goto(origin)
	const requests: number[] = []
	// APIRequestContext does not use page.route; inject a synthetic read response.
	const originalGet = page.request.get.bind(page.request)
	page.request.get = async (_url, options) => {
		const pageNumber = Number((options.params as any).page)
		requests.push(pageNumber)
		return { ok: () => true, headers: () => ({ 'x-wp-totalpages': '2' }), json: async () => pageNumber === 1 ? [] : [{
			id: 101, sku: 'fixture', categories: [{ id: 331 }], prices: { currency_code: 'USD', currency_minor_unit: 2, price: '3900' },
		}] } as any
	}
	try {
		const products = await new ShopPage(page, 'chromium', info).getCategoryProducts([331])
		expect(requests).toEqual([1, 2])
		expect(products).toHaveLength(1)
		expect(products[0]).toMatchObject({ productId: 101, categoryIds: [331], unitPrice: '39.00' })
	} finally { page.request.get = originalGet }
})

test('thank-you total is checked regardless of legacy tax bypass', async ({ page }) => {
	const origin = 'https://bulk-order.test'
	await page.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body:
		`<div class="woocommerce-order-overview__order"><strong>123</strong></div><div class="woocommerce-order-overview__total"><strong>${dollars(expected.total)}</strong></div>` }))
	await page.goto(`${origin}/checkout/order-received/123`)
	expect(await new OrderReceivedPage(page).verifyDiscountedTotal(expected)).toBe('123')
})

for (const hasNotes of [false, true]) {
	test(`bulk checkout submits with ${hasNotes ? 'an available' : 'no'} optional notes field`, async ({ page }) => {
		await page.route('https://bulk-order.test/checkout/', route => route.fulfill({ contentType: 'text/html', body: `
			${hasNotes ? '<textarea name="order_comments"></textarea>' : ''}
			<table class="woocommerce-checkout-review-order-table">${summaryRows(expected, true, false)}</table>
			<div id="svntnAcuityDayChoices"><button class="acuityChoice">Tuesday</button></div>
			<div id="svntnAcuityTimeChoices" hidden><button class="acuityChoice">9 AM</button></div>
			<label><input type="checkbox">I understand my reserved items will be released if not picked up</label>
			<button id="place_order" disabled>Place your order</button>
			<script>
			const day = document.querySelector('#svntnAcuityDayChoices button');
			const time = document.querySelector('#svntnAcuityTimeChoices button');
			const commit = document.querySelector('input');
			const submit = document.querySelector('#place_order');
			day.onclick = () => { document.querySelector('#svntnAcuityTimeChoices').hidden = false; };
			time.onclick = () => { document.body.dataset.slot = 'selected'; };
			commit.onchange = () => { submit.disabled = !(commit.checked && document.body.dataset.slot === 'selected'); };
			submit.onclick = () => { document.body.dataset.submitted = 'true'; };
			</script>` }))
		await page.goto('https://bulk-order.test/checkout/')
		const note = 'bulk-regression:Doinks Tiers:Desktop Chrome:fixture'
		await new CheckoutPage(page, null!).submitDiscountOrder(expected, note)
		await expect(page.locator('body')).toHaveAttribute('data-submitted', 'true')
		if (hasNotes) await expect(page.locator('[name="order_comments"]')).toHaveValue(note)
	})
}

test('currency parsing rejects missing amounts and handles thousands/discount signs', () => {
	expect(moneyInCents('-$1,234.56')).toBe(123456)
	expect(() => moneyInCents('not available')).toThrow()
	expect(moneyInCents('$5', true)).toBe(500)
	expect(moneyInCents('$7.00', true)).toBe(700)
	for (const invalid of ['$5.001', '$5 off each', '$5 $7']) expect(() => moneyInCents(invalid, true)).toThrow()
	expect(() => moneyInCents('$5')).toThrow()
})

// Synthetic prices chosen to reproduce the supplied $441 subtotal. They are not
// asserted to be the dev products' prices; live specs still discover their prices.
const suppliedCart = [
	{ productId: 101, categoryIds: [327], qty: 3, unitPrice: '57.00', isFreeBogoUnit: false },
	{ productId: 202, categoryIds: [323], qty: 5, unitPrice: '54.00', isFreeBogoUnit: false },
]
const suppliedExpected = expectedCart(suppliedCart)

test('supplied cart tbody and checkout tfoot reconcile without coupon controls', async ({ page }, info) => {
	await page.setContent(`<div class="cart_totals"><table>${suppliedSummaryMarkup(false, false)}</table></div><table class="woocommerce-checkout-review-order-table">${suppliedSummaryMarkup(true, false)}</table>`)
	await new CartPage(page, null!, 'chromium', info, 'recreational').verifyDiscountPricing(suppliedExpected)
	await new CheckoutPage(page, null!).verifyDiscountPricing(suppliedExpected)
})

test('supplied cart and checkout pricing reconcile with existing coupon controls', async ({ page }, info) => {
	await page.setContent(`<div class="cart_totals"><table>${suppliedSummaryMarkup()}</table></div><table class="woocommerce-checkout-review-order-table">${suppliedSummaryMarkup(true)}</table>`)
	await new CartPage(page, null!, 'chromium', info, 'recreational').verifyDiscountPricing(suppliedExpected)
	await new CheckoutPage(page, null!).verifyDiscountPricing(suppliedExpected)
})

test('shop offer chips use whole-dollar amounts and never become product prices', async ({ page }, info) => {
	await page.setContent(`<ul><li class="product"><h2>Vape fixture</h2><div class="price"><span class="woocommerce-Price-amount amount">$39.00</span></div>${shopOffersMarkup}<button class="add_to_cart_button" data-product_id="202" data-product_sku="vape">Add</button></li></ul>`)
	const shop = new ShopPage(page, 'chromium', info)
	const [candidate] = await shop.getAddableStorefrontProducts()
	expect(candidate.price).toBe(39)
	const product = { ...candidate, productId: 202, categoryIds: [323], unitPrice: '39.00' }
	const tiers = [{ min: 3, amountPerUnit: '5.00' }, { min: 5, amountPerUnit: '7.00' }]
	await shop.verifyProductPricingOffers(product, tiers)
	await expect(shop.verifyProductPricingOffers(product, [{ min: 3, amountPerUnit: '3.00' }, { min: 5, amountPerUnit: '5.00' }])).rejects.toThrow('discount per unit at 3+')
})

for (const wrapped of [false, true]) test(`category pricing offers belong to the ${wrapped ? 'wrapped' : 'unwrapped'} product list`, async ({ page }, info) => {
	const card = (id: number) => `<li class="product"><h2>Product ${id}</h2><div class="price"><span class="amount">$39.00</span></div><button class="add_to_cart_button" data-product_id="${id}">Add</button></li>`
	// The live shop wraps ul.products in this container after rendering.
	const list = (id: number) => wrapped
		? `<div class="products-container standard-list"><ul class="products">${card(id)}</ul></div>`
		: `<ul class="products">${card(id)}</ul>`
	const cheaperOffers = shopOffersMarkup.replace('$</span>5', '$</span>3').replace('$</span>7', '$</span>5')
	await page.setContent(`<h1>Gummis</h1>${cheaperOffers}${list(101)}<h1>Vapes</h1>${shopOffersMarkup}${list(202)}<h1>No offers</h1>${list(303)}`)
	const shop = new ShopPage(page, 'chromium', info)
	const products = (await shop.getAddableStorefrontProducts()).map(candidate => ({ ...candidate, productId: candidate.productId!, categoryIds: [], unitPrice: '39.00' }))
	const vapeTiers = [{ min: 3, amountPerUnit: '5.00' }, { min: 5, amountPerUnit: '7.00' }]
	await shop.verifyProductPricingOffers(products[0], [{ min: 3, amountPerUnit: '3.00' }, { min: 5, amountPerUnit: '5.00' }])
	await shop.verifyProductPricingOffers(products[1], vapeTiers)
	await expect(shop.verifyProductPricingOffers(products[0], vapeTiers)).rejects.toThrow('discount per unit at 3+')
	await expect(shop.verifyProductPricingOffers(products[2], vapeTiers)).rejects.toThrow('toHaveCount')
})

test('cart badges match each product category and the coupon keys supplied in the markup', async ({ page }, info) => {
	await page.setContent(productTagsMarkup)
	const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
	await cart.verifyProductDiscountTags([...suppliedCart, { productId: 303, categoryIds: [324] }], suppliedExpected.discountLines)
	await page.locator('[data-wdr-coupon="live-rosin"]').evaluate(tag => tag.setAttribute('data-wdr-coupon', 'wrong-coupon'))
	await expect(cart.verifyProductDiscountTags(suppliedCart, suppliedExpected.discountLines)).rejects.toThrow('data-wdr-coupon')
})

test('cart tier badges replace 3+ with 5+ and disappear below threshold', async ({ page }, info) => {
	const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
	const line = { productId: 101, categoryIds: [327], qty: 3, unitPrice: '57.00', isFreeBogoUnit: false }
	await page.setContent(productTagsMarkup)
	await cart.verifyProductDiscountTags([line], expectedCart([line]).discountLines)
	line.qty = 5
	await expect(cart.verifyProductDiscountTags([line], expectedCart([line]).discountLines)).rejects.toThrow('toHaveText')
	await page.locator('[data-wdr-coupon="live-rosin"]').evaluate(tag => { tag.textContent = 'Live Rosin Badder 5+' })
	await cart.verifyProductDiscountTags([line], expectedCart([line]).discountLines)
	line.qty = 2
	await expect(cart.verifyProductDiscountTags([line], expectedCart([line]).discountLines)).rejects.toThrow('only the active category tier')
	await page.locator('[data-wdr-coupon="live-rosin"]').evaluate(tag => tag.remove())
	await cart.verifyProductDiscountTags([line], expectedCart([line]).discountLines)
})
