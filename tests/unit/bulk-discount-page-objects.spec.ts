import { test, expect } from '@playwright/test'
import { readStoreTaxConfiguration } from '../../support/bulk-discounts/store-tax-configuration'
import { CartPage } from '../../models/cart-page'
import { CheckoutPage } from '../../models/checkout-page'
import { ShopPage, ProductInventoryUnavailableError } from '../../models/shop-page'
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
		${pricing.discountLines.map(line => `<tr class="cart-discount${cart && line.categoryId ? ' svntn-wdr-row' : ''}${line.couponKey ? ` coupon-${line.couponKey}` : ''}"><th>${line.label}</th><td>-${amount(line.amount)}${removeLink ? '<a class="woocommerce-remove-coupon">[Remove]</a>' : ''}</td></tr>`).join('')}
		${['gross', 'excise', 'sales'].map(key => `<tr class="tax-rate"><th>${key}</th><td>${amount(pricing[key])}</td></tr>`).join('')}
		<tr class="order-total"><th>Total</th><td>${amount(pricing.total)}</td></tr>`
}

for (const [store, grossRate, observed] of [
	['March and Ash Mill Valley', '8%', [816, 1652, 1203, 13871]],
	['Spaceflyt Sandbox', '10%', [1020, 1683, 1226, 14129]],
] as const) {
	test(`bulk pricing accepts the selected store and independently checks its taxes: ${store}`, async ({ browser }, info) => {
		const context = await browser.newContext({ baseURL: 'https://store-tax.test' })
		try {
			const page = await context.newPage()
			await page.route('https://store-tax.test/', route => route.fulfill({ contentType: 'text/html', body:
				`<button class="wcse-nav">Pickup | ${store}</button><ul><li class="product">Product</li></ul>` }))
			const shop = new ShopPage(page, 'chromium', info)
			await shop.openStorefrontForFulfillment('Pickup')
			expect(await shop.getFulfillmentLabel()).toBe(`Pickup | ${store}`)
			page.request.get = async (url, options) => {
				expect(url).toBe('https://store-tax.test/wp-json/wc/store/v1/cart')
				expect(options.maxRedirects).toBe(0)
				return { ok: () => true, json: async () => ({ totals: { tax_lines: [
					{ name: 'Gross', rate: grossRate, price: '99999' },
					{ name: 'Excise', rate: '15%', price: '99999' },
					{ name: 'Sales', rate: '9.5%', price: '99999' },
				] } }) } as any
			}
			const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
			const metadata = await cart.getTaxRateMetadata()
			expect(metadata.every(line => !('price' in line))).toBe(true)
			const { rulesForEnvironment } = require('../../support/bulk-discounts/tax-profiles.cjs')
			const { rulesWithCartTaxRates } = require('../../support/bulk-discounts/cart-tax-rates.cjs')
			const pricing = expectedCart([{ productId: 101, categoryIds: [331], qty: 3, unitPrice: '39.00', isFreeBogoUnit: false }], 'plain',
				rulesWithCartTaxRates(rulesForEnvironment('https://thelist-stage.710labs.com'), metadata))
			const [gross, excise, sales, total] = observed
			await page.setContent(`<div class="cart_totals"><table>${summaryRows({ ...pricing, gross, excise, sales, total })}</table></div>`)
			await cart.verifyDiscountPricing(pricing)
		} finally { await context.close() }
	})
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

test('Stage cart and checkout accept Stage coupon metadata with the shared pricing assertions', async ({ page }, info) => {
	const { rulesForEnvironment } = require('../../support/bulk-discounts/tax-profiles.cjs')
	const { bindCategoryIds } = require('../../support/bulk-discounts/categories.cjs')
	const rules = bindCategoryIds(rulesForEnvironment('https://thelist-stage.710labs.com'), {
		'live-rosin-vapes': 319, 'live-rosin-badder': 312, 'gummis-2': 323, eighths: 325, doinks: 320,
	})
	const pricing = expectedCart([
		{ productId: 101, categoryIds: [319], qty: 3, unitPrice: '39.00', isFreeBogoUnit: false },
		{ productId: 102, categoryIds: [312], qty: 5, unitPrice: '39.00', isFreeBogoUnit: false },
	], 'plain', rules)
	expect(pricing.discountLines.map(line => line.couponKey)).toEqual(['live-rosin-vapes', 'live-rosin-badder'])
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
			let menuLoads = 0
			const clickedIds: number[] = []
			await page.route('https://cart-confirm.test/**', async route => {
				const path = new URL(route.request().url()).pathname
				if (path === '/add') {
					addRequests++
					clickedIds.push(route.request().postDataJSON().id)
					const id = mode === 'stale-header' ? 101 : 202
					quantities.set(id, (quantities.get(id) || 0) + 1)
					await route.fulfill({ json: { count: [...quantities.values()].reduce((sum, qty) => sum + qty, 0) } })
				} else if (path === '/cart/') {
					await route.fulfill({ contentType: 'text/html', body: `<h1>Cart</h1><form class="woocommerce-cart-form"><table>
						${[...quantities].map(([id, qty]) => `<tr class="cart_item"><td><a data-product_id="${id}">Same visible name</a></td><td><input class="qty" value="${qty}"></td></tr>`).join('')}
						</table></form>` })
				} else {
					menuLoads++
					const menuIds = menuLoads % 2 ? [101, 202] : [202, 101]
					await route.fulfill({ contentType: 'text/html', body: `<a href="/cart/">My Bag (${[...quantities.values()].reduce((sum, qty) => sum + qty, 0)})</a>
						<ul>${menuIds.map(id => `<li class="product"><h2>Same visible name</h2><span class="price">$39.00</span><button class="add_to_cart_button" data-product_id="${id}" data-product_sku="sku-${id}">Add</button></li>`).join('')}</ul>
						<script>document.querySelectorAll('button').forEach(button => button.onclick = async () => {
							const result = await (await fetch('/add', { method: 'POST', headers: {'Content-Type':'application/json'}, body:JSON.stringify({id:Number(button.dataset.product_id)}) })).json();
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
			expect(clickedIds, 'Reordering the menu must not change the selected product').toEqual([101])
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
			id: 101, sku: 'fixture', is_in_stock: true, low_stock_remaining: 1, add_to_cart: { maximum: 1 }, categories: [{ id: 331 }], prices: { currency_code: 'USD', currency_minor_unit: 2, price: '3900' },
		}] } as any
	}
	try {
		const products = await new ShopPage(page, 'chromium', info).getCategoryProducts([331])
		expect(requests).toEqual([1, 2])
		expect(products).toHaveLength(1)
		expect(products[0]).toMatchObject({ productId: 101, categoryIds: [331], unitPrice: '39.00', maxQuantity: 1 })
	} finally { page.request.get = originalGet }
})

test('category slugs resolve across reordered pages with different environment IDs', async ({ page }, info) => {
	await page.route('https://categories.test/', route => route.fulfill({ contentType: 'text/html', body: '<h1>Shop</h1>' }))
	await page.goto('https://categories.test/')
	const originalGet = page.request.get.bind(page.request)
	const requests: number[] = []
	page.request.get = async (url, options) => {
		expect(url).toBe('https://categories.test/wp-json/wc/store/v1/products/categories')
		expect(options.maxRedirects).toBe(0)
		const number = Number((options.params as any).page)
		requests.push(number)
		return { ok: () => true, headers: () => ({ 'x-wp-totalpages': '2' }), json: async () => number === 1
			? [{ id: 324, slug: 'persy-doinks' }, { id: 325, slug: 'eighths' }]
			: [{ id: 323, slug: 'gummis-2' }, { id: 319, slug: 'live-rosin-vapes' }] } as any
	}
	try {
		const shop = new ShopPage(page, 'chromium', info)
		expect(await shop.getCategoryIdsBySlug(['live-rosin-vapes', 'gummis-2', 'eighths']))
			.toEqual({ 'live-rosin-vapes': 319, 'gummis-2': 323, eighths: 325 })
		expect(requests).toEqual([1, 2])
		await expect(shop.getCategoryIdsBySlug(['missing'])).rejects.toThrow('Exactly one product category')
		expect(await shop.getCategoryIdsBySlug(['missing', 'eighths'], { allowMissing: true })).toEqual({ eighths: 325 })
	} finally { page.request.get = originalGet }
})

test('cart cleanup waits for asynchronous removal before targeting the next product', async ({ browser }, info) => {
	const context = await browser.newContext({ baseURL: 'https://cleanup.test' })
	try {
		const page = await context.newPage()
		await page.route('https://cleanup.test/cart/', route => route.fulfill({ contentType: 'text/html', body: `
			<h1>Cart</h1><form class="woocommerce-cart-form"><table>
			${[101, 202].map(id => `<tr class="cart_item"><td class="product-remove"><a class="remove" data-product_id="${id}" href="#">Remove</a></td></tr>`).join('')}
			</table></form><script>
			document.querySelectorAll('a.remove').forEach(link => link.onclick = event => {
				event.preventDefault();
				const overlay = document.createElement('div'); overlay.className='blockUI blockOverlay';
				overlay.style='position:fixed;inset:0;background:#fff8;z-index:9999'; document.body.append(overlay);
				setTimeout(() => { link.closest('tr').remove(); }, 700);
				setTimeout(() => { overlay.remove(); }, 1100);
			});</script>` }))
		await page.goto('https://cleanup.test/cart/')
		await new ShopPage(page, 'chromium', info).clearStorefrontCart()
		await expect(page.locator('.cart_item')).toHaveCount(0)
	} finally { await context.close() }
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
	await page.route('https://offers.test/', route => route.fulfill({ contentType: 'text/html', body:
		`<h1>Gummis</h1>${cheaperOffers}${list(101)}<h1>Vapes</h1>${shopOffersMarkup}${list(202)}<h1>No offers</h1>${list(303)}` }))
	await page.goto('https://offers.test/')
	const shop = new ShopPage(page, 'chromium', info)
	const originalGet = page.request.get.bind(page.request)
	page.request.get = async (_url, options) => {
		const category = Number((options.params as Record<string, unknown>).category)
		return { ok: () => true, headers: () => ({}), json: async () => [{ id: category, categories: [{ id: category }],
			prices: { currency_code: 'USD', currency_minor_unit: 2, price: '3900' } }] } as any
	}
	const products = await shop.getCategoryProducts([101, 202, 303], 'recreational', { readBulkOffers: true })
	page.request.get = originalGet
	expect(products.map(product => [product.productId, product.hasBulkOffer])).toEqual([[101, true], [202, true], [303, false]])
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

for (const taxLines of [[], [{ label: 'Sales (State)', amount: 676 }], [
	{ label: 'Sales', amount: 612 }, { label: 'Sales Local', amount: 204 },
]]) {
	test(`cart and checkout verify state-specific tax rows: ${taxLines.map(line => line.label).join(', ') || 'tax free'}`, async ({ page }, info) => {
		const pricing = { ...expected, taxLines, total: 10200 + taxLines.reduce((sum, line) => sum + line.amount, 0) }
		const rows = summaryRows(pricing).replace(/<tr class="tax-rate">.*?<\/tr>/g, '') +
			taxLines.map(line => `<tr class="tax-rate"><th>${line.label}</th><td>${amount(line.amount)}</td></tr>`).join('')
		await page.setContent(`<div class="cart_totals"><table>${rows}</table></div><table class="woocommerce-checkout-review-order-table">${rows}</table>`)
		await new CartPage(page, null!, 'chromium', info, 'recreational').verifyDiscountPricing(pricing)
		await new CheckoutPage(page, null!).verifyDiscountPricing(pricing)
	})
}

test('state tax assertions reject an incorrect amount even if the total is correct', async ({ page }, info) => {
	test.setTimeout(15000)
	const pricing = { ...expected, taxLines: [{ label: 'Sales', amount: 676 }], total: 10876 }
	const rows = summaryRows(pricing).replace(/<tr class="tax-rate">.*?<\/tr>/g, '') +
		`<tr class="tax-rate"><th>Sales</th><td>${amount(675)}</td></tr>`
	await page.setContent(`<div class="cart_totals"><table>${rows}</table></div>`)
	await expect(new CartPage(page, null!, 'chromium', info, 'recreational').verifyDiscountPricing(pricing)).rejects.toThrow('Sales tax')
})

test('delivery fulfillment uses the scenario address and includes medical-only inventory', async ({ browser }, info) => {
	const context = await browser.newContext({ baseURL: 'https://delivery.test' })
	try {
		const page = await context.newPage()
		await page.route('https://delivery.test/', route => route.fulfill({ contentType: 'text/html', body: `
			<div id="fulfillmentElement"><h2>How do you want your order?</h2><button>Delivery</button>
			<input id="fasd_address"><button class="wpse-button-primary fasd-form-submit"
				onclick="document.getElementById('fulfillmentElement').hidden = true">Confirm address</button></div>
			<button class="wcse-nav">Delivery</button><ul><li class="product"><h2>Medical product</h2>
			<span class="medOnly">Medical only</span><span class="price">$39.00</span>
			<button class="add_to_cart_button" data-product_id="101">Add</button></li></ul>` }))
		const address = '1845 Town Center Blvd, Fleming Island, FL 32003'
		const shop = new ShopPage(page, 'chromium', info, { deliveryAddress: address })
		await shop.openStorefrontForFulfillment('Delivery')
		await expect(page.locator('#fasd_address')).toHaveValue(address)
		expect((await shop.getAddableStorefrontProducts('medical')).map(product => product.productId)).toEqual([101])
		expect(await shop.getAddableStorefrontProducts('recreational')).toEqual([])
	} finally { await context.close() }
})

for (const testState of ['MI', 'CO']) {
	test(`${testState} bulk cart uses the selected MI store's tax jurisdiction and checks checkout`, async ({ browser }, info) => {
		const context = await browser.newContext({ baseURL: 'https://store-tax.test' })
		try {
			const page = await context.newPage()
			await page.route('https://store-tax.test/', route => route.fulfill({ contentType: 'text/html', body: '<main>Cart</main>' }))
			await page.goto('/')
			const observed = { ...expected, total: 11893 }
			const rows = summaryRows(observed).replace(/<tr class="tax-rate">.*?<\/tr>/g, '') +
				'<tr class="tax-rate tax-rate-us-mi-excise-tax-1"><th>Excise Tax <small>(estimated for the United States (US))</small></th><td data-title="Excise Tax"><span class="amount">$10.20</span></td></tr>' +
				'<tr class="tax-rate tax-rate-us-mi-sales-tax-2"><th>Sales Tax <small>(estimated for the United States (US))</small></th><td data-title="Sales Tax"><span class="amount">$6.73</span></td></tr>'
			await page.setContent(`<div class="cart_totals"><table>${rows}</table></div><table class="woocommerce-checkout-review-order-table">${rows}</table>`)
			page.request.get = async () => ({ ok: () => true, json: async () => ({ totals: { tax_lines: [
				{ name: 'Sales Tax', rate: '6%', price: '999999' }, { name: 'Excise Tax', rate: '10%', price: '999999' },
			] } }) }) as any
			const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
			const metadata = await cart.getTaxRateMetadata()
			expect(metadata).toEqual([
				{ name: 'Sales Tax', rate: '6%', code: 'tax-rate-us-mi-sales-tax-2' },
				{ name: 'Excise Tax', rate: '10%', code: 'tax-rate-us-mi-excise-tax-1' },
			])
			const { rulesForEnvironment } = require('../../support/bulk-discounts/tax-profiles.cjs')
			const { rulesWithCartTaxRates } = require('../../support/bulk-discounts/cart-tax-rates.cjs')
			const pricing = expectedCart([{ productId: 101, categoryIds: [331], qty: 3, unitPrice: '39.00', isFreeBogoUnit: false }], 'plain',
				rulesWithCartTaxRates(rulesForEnvironment('https://thelist-stage.710labs.com'), metadata, [
					{ country: 'US', state: 'CA', label: 'County Gross Tax', rate: '10.0000', priority: 1, compound: true },
					{ country: 'US', state: 'MI', label: 'Excise Tax', rate: '10.0000', priority: 1, compound: true },
					{ country: 'US', state: 'MI', label: 'Sales Tax', rate: '6.0000', priority: 2, compound: true },
				]))
			expect(pricing.total).toBe(11893)
			await cart.verifyDiscountPricing(pricing)
			await new CheckoutPage(page, null!).verifyDiscountPricing(pricing)
		} finally { await context.close() }
	})
}

test('store tax configuration reuses private admin login once and reads all configuration rows without saving', async ({ browser }) => {
	const original = { user: process.env.ADMIN_USER, password: process.env.ADMIN_PW }
	process.env.ADMIN_USER = 'tax-login-canary-user'
	process.env.ADMIN_PW = 'tax-login-canary-password'
	let contexts = 0
	let logins = 0
	let settingsReads = 0
	const rates = [
		{ tax_rate_country: 'US', tax_rate_state: 'MI', tax_rate_name: 'Excise Tax', tax_rate: '10.0000', tax_rate_priority: '1', tax_rate_compound: '1' },
		{ tax_rate_country: 'US', tax_rate_state: 'MI', tax_rate_name: 'Sales Tax', tax_rate: '6.0000', tax_rate_priority: '2', tax_rate_compound: '1' },
	]
	const isolatedBrowser = { newContext: async options => {
		contexts++
		expect(options.recordVideo).toBeUndefined()
		const context = await browser.newContext(options)
		const newPage = context.newPage.bind(context)
		context.newPage = async () => {
			const page = await newPage()
			await page.route('https://thelist-stage.710labs.com/**', async route => {
				const request = route.request()
				const url = new URL(request.url())
				if (request.method() === 'POST') {
					logins++
					const form = new URLSearchParams(request.postData() || '')
					expect(form.get('log') === process.env.ADMIN_USER && form.get('pwd') === process.env.ADMIN_PW).toBe(true)
					await route.fulfill({ contentType: 'text/html', body: '<div id="wp-admin-bar-my-account">Admin</div>' })
				} else if (url.searchParams.get('tab') === 'tax') {
					settingsReads++
					await route.fulfill({ contentType: 'text/html', body: `<table class="wc_tax_rates"><tr><td>First page only</td></tr></table><script>window.htmlSettingsTaxLocalizeScript=${JSON.stringify({ rates, wc_tax_nonce: 'excluded' })}</script>` })
				} else {
					await route.fulfill({ contentType: 'text/html', body: '<form method="post"><input name="log"><input name="pwd" type="password"><input name="wp-submit" type="submit"></form>' })
				}
			})
			return page
		}
		return context
	} } as typeof browser
	try {
		const config = await readStoreTaxConfiguration(isolatedBrowser, 'https://thelist-stage.710labs.com', undefined, 'standard')
		expect(config).toEqual([
			{ country: 'US', state: 'MI', label: 'Excise Tax', rate: '10.0000', priority: 1, compound: true },
			{ country: 'US', state: 'MI', label: 'Sales Tax', rate: '6.0000', priority: 2, compound: true },
		])
		expect(await readStoreTaxConfiguration(isolatedBrowser, 'https://thelist-stage.710labs.com', undefined, 'standard')).toBe(config)
		expect({ contexts, logins, settingsReads }).toEqual({ contexts: 1, logins: 1, settingsReads: 1 })
	} finally {
		if (original.user === undefined) delete process.env.ADMIN_USER; else process.env.ADMIN_USER = original.user
		if (original.password === undefined) delete process.env.ADMIN_PW; else process.env.ADMIN_PW = original.password
	}
})

for (const control of ['hidden', 'readonly', 'maximum', 'missing']) {
	test(`quantity capacity rejects a ${control} control before filling`, async ({ page }, info) => {
		const input = control === 'missing' ? '' : `<input class="qty" value="1" ${control === 'hidden' ? 'type="hidden" max="1"' : control === 'readonly' ? 'readonly' : 'max="2"'}>`
		await page.setContent(`<form class="woocommerce-cart-form"><table><tr class="cart_item"><td><a data-product_id="101">Product</a>${input}</td></tr></table></form>`)
		const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
	expect(await cart.quantityUnavailability(101, 6)).toMatchObject({ stockLimited: ['hidden', 'maximum'].includes(control) })
		await expect(cart.setProductQuantity(101, 6)).rejects.toThrow('cannot reach 6 units')
	})
}

for (const missingInput of [false, true]) test(`bulk product selection replaces the restricted candidate: ${missingInput ? 'absent input' : 'last unit'}`, async ({ browser }, info) => {
	const context = await browser.newContext({ baseURL: 'https://inventory.test' })
	try {
		const page = await context.newPage()
		const quantities = new Map<number, number>()
		const added: number[] = []
		await page.route('https://inventory.test/**', async route => {
			const url = new URL(route.request().url())
			if (url.pathname === '/add') {
				const id = Number(route.request().postDataJSON().id)
				quantities.set(id, 1); added.push(id)
				await route.fulfill({ json: { count: quantities.size } })
			} else if (url.pathname === '/cart/') {
				if (url.searchParams.has('remove')) quantities.delete(Number(url.searchParams.get('remove')))
				await route.fulfill({ contentType: 'text/html', body: `<h1>Cart</h1><form class="woocommerce-cart-form"><table>${[...quantities].map(([id, qty]) =>
					`<tr class="cart_item"><td class="product-remove"><a data-product_id="${id}" href="/cart/?remove=${id}">Remove</a></td><td><input class="qty" value="${qty}" ${id === 101 ? 'type="hidden" max="1"' : 'type="number" max="10"'}></td></tr>`.replace(id === 101 && missingInput ? /<input[^>]+>/ : /NEVER_MATCH/, '')).join('')}</table></form>` })
			} else {
				await route.fulfill({ contentType: 'text/html', body: `<a href="/cart/">My Bag (${quantities.size})</a><ul>${[101,202].map(id =>
					`<li class="product"><h2>Product ${id}</h2><span class="price">$39</span><button class="add_to_cart_button" data-product_id="${id}">Add</button></li>`).join('')}</ul>
					<script>document.querySelectorAll('button').forEach(button=>button.onclick=async()=>{ const data=await(await fetch('/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:button.dataset.product_id})})).json();document.querySelector('a').textContent='My Bag ('+data.count+')' })</script>` })
			}
		})
		await page.goto('/')
		const shop = new ShopPage(page, 'chromium', info)
		const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
		const candidates = (await shop.getAddableStorefrontProducts()).map(candidate => ({ ...candidate, productId: candidate.productId!, categoryIds: [331], unitPrice: '39.00' }))
		const selected = await shop.addQuantityCapableProduct(candidates, cart, 6)
		expect(selected.productId).toBe(202)
		expect(added).toEqual([101,202])
		expect(await cart.getProductQuantity(101)).toBe(0)
		await cart.verifyProductQuantity(202, 1)
		expect(info.annotations.some(a => a.type === 'inventory-candidate-rejected' && a.description?.includes('101'))).toBe(true)
		await expect(shop.addQuantityCapableProduct([{ ...candidates[0], maxQuantity: 1 }], cart, 6)).rejects.toBeInstanceOf(ProductInventoryUnavailableError)
		expect(added).toEqual([101,202])
		if (missingInput) {
			const error = await shop.addQuantityCapableProduct([candidates[0]], cart, 6).catch(error => error)
			expect(error).toBeInstanceOf(Error)
			expect(error).not.toBeInstanceOf(ProductInventoryUnavailableError)
			await cart.verifyProductQuantity(202, 1)
		}
	} finally { await context.close() }
})

for (const method of ['pickup','delivery']) test(`tax jurisdiction follows the selected ${method} address`, async ({ page }, info) => {
	await page.setContent(`<div id="fulfillmentElement" data-toggle="${method}"><p class="wcse-reactive--origin">933 Alpine Ave, Boulder, CO 80304</p><p class="wcse-reactive--destination-link"><a>Fresh Cannabis, Eatontown, NJ 07724</a></p></div>`)
	const shop = new ShopPage(page, 'chromium', info)
	expect(await shop.getFulfillmentTaxLocation()).toEqual({ country: 'US', state: method === 'pickup' ? 'NJ' : 'CO' })
	await page.locator('#fulfillmentElement').evaluate(element => element.setAttribute('data-toggle','unknown'))
	await expect(shop.getFulfillmentTaxLocation()).rejects.toThrow('selected fulfillment method')
})
