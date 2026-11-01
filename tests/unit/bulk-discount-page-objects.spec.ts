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

test('cart rejects a stale tier and a nonfunctional Remove link', async ({ page }, info) => {
	const cart = new CartPage(page, null!, 'chromium', info, 'recreational')
	await page.setContent(`<div class="cart_totals"><table>${summaryRows(expected, true)}</table></div>`)
	await expect(cart.verifyDiscountPricing(expected)).rejects.toThrow()
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

test('supplied cart tbody and checkout tfoot reconcile once Remove links are absent', async ({ page }, info) => {
	await page.setContent(`<div class="cart_totals"><table>${suppliedSummaryMarkup(false, false)}</table></div><table class="woocommerce-checkout-review-order-table">${suppliedSummaryMarkup(true, false)}</table>`)
	await new CartPage(page, null!, 'chromium', info, 'recreational').verifyDiscountPricing(suppliedExpected)
	await new CheckoutPage(page, null!).verifyDiscountPricing(suppliedExpected)
})

test('the supplied Remove links fail the specific automatic-coupon control assertion', async ({ page }, info) => {
	await page.setContent(`<div class="cart_totals"><table>${suppliedSummaryMarkup()}</table></div><table class="woocommerce-checkout-review-order-table">${suppliedSummaryMarkup(true)}</table>`)
	await expect(new CartPage(page, null!, 'chromium', info, 'recreational').verifyDiscountPricing(suppliedExpected)).rejects.toThrow('Automatic discount rows must not expose coupon removal controls')
	await expect(new CheckoutPage(page, null!).verifyDiscountPricing(suppliedExpected)).rejects.toThrow('Automatic discount rows must not expose coupon removal controls')
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
