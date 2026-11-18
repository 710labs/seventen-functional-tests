import { expect, test, type Page } from '@playwright/test'
import { CartPage } from '../../models/cart-page'
import {
	ProductInventoryUnavailableError,
	RecreationalInventoryUnavailableError,
	ShopPage,
	type ShopFulfillment,
} from '../../models/shop-page'
import { buildListOrderCart } from '../../support/list-order-cart'
import type { TestUsageType } from '../../utils/usage-types'

const origin = 'https://list-smoke-cart.test'
test.use({ baseURL: origin })

type Product = {
	id: number
	price: number
	max?: number
	stock?: number
	medical?: 'badge' | 'title'
	hideAdd?: boolean
	waitlist?: boolean
}
type StorefrontOptions = {
	showShortfall?: boolean
	fulfillment?: ShopFulfillment
	waitlistSubmissions?: number[]
	rejectWaitlist?: boolean
}

async function mockStorefront(page: Page, products: Product[], minimum: number, cartPath = '/cart/', {
	showShortfall = true,
	fulfillment = 'Pickup',
	waitlistSubmissions = [],
	rejectWaitlist = false,
}: StorefrontOptions = {}) {
	const quantities = new Map<number, number>()
	await page.route(`${origin}/**`, async route => {
		const { pathname } = new URL(route.request().url())
		if (pathname === '/waitlist') {
			waitlistSubmissions.push(route.request().postDataJSON().id)
			await route.fulfill({ status: rejectWaitlist ? 409 : 200 })
			return
		}
		if (pathname === '/add' || pathname === '/quantity') {
			const { id, quantity } = route.request().postDataJSON()
			const product = products.find(product => product.id === id)!
			const stock = product.stock ?? product.max ?? Infinity
			quantities.set(id, Math.min(quantity, stock))
			await route.fulfill({ json: { count: [...quantities.values()].reduce((sum, value) => sum + value, 0) } })
			return
		}
		if (pathname === '/') {
			await route.fulfill({ contentType: 'text/html', body: `
				<button class="wcse-nav">${fulfillment}</button>
				<a class="cart-contents" href="${cartPath}">Cart (${[...quantities.values()].reduce((sum, value) => sum + value, 0)})</a>
				<ul>${products.map(({ id, price, medical, hideAdd, waitlist }) => `<li class="product">
					<h2>Product ${id}${medical === 'title' ? ' (MED CARD REQUIRED)' : ''}</h2>
					${medical === 'badge' ? '<span class="medOnly">MED ONLY</span>' : ''}
					<span class="price">$${price}</span>
					${waitlist ? `<span>Sold Out</span><button class="waitlist-button" data-product_id="${id}">Join Waitlist</button>` : ''}
					${hideAdd || waitlist ? '' : `<button class="add_to_cart_button" data-product_id="${id}">Add</button>`}</li>`).join('')}</ul>
				<div id="waitlistElement" hidden>
					<input type="hidden" id="waitlist_product_id">
					<input type="hidden" id="waitlist_method" value="${fulfillment.toLowerCase()}">
					<div id="waitlist_error"></div>
					<button id="waitlistSubmit">Join waitlist</button>
				</div>
				<script>
					for (const button of document.querySelectorAll('.add_to_cart_button')) {
						button.onclick = async () => {
							const response = await fetch('/add', { method: 'POST', body: JSON.stringify({ id: +button.dataset.product_id, quantity: 1 }) })
							document.querySelector('.cart-contents').textContent = 'Cart (' + (await response.json()).count + ')'
						}
					}
					const modal = document.querySelector('#waitlistElement')
					const productId = modal.querySelector('#waitlist_product_id')
					for (const button of document.querySelectorAll('.waitlist-button')) {
						button.onclick = () => {
							productId.value = button.dataset.product_id
							modal.hidden = false
						}
					}
					modal.querySelector('#waitlistSubmit').onclick = async () => {
						const id = Number(productId.value)
						const response = await fetch('/waitlist', { method: 'POST', body: JSON.stringify({ id }) })
						if (!response.ok) {
							modal.querySelector('#waitlist_error').textContent = 'Waitlist submission failed'
							return
						}
						const button = document.querySelector('.waitlist-button[data-product_id="' + id + '"]')
						button.textContent = 'On waitlist'
						button.classList.add('on-waitlist')
						button.setAttribute('aria-disabled', 'true')
						modal.hidden = true
					}
				</script>` })
			return
		}
		if (pathname !== cartPath) return route.fulfill({ status: 404 })

		const subtotal = products.reduce((sum, { id, price }) => sum + price * (quantities.get(id) || 0), 0)
		await route.fulfill({ contentType: 'text/html', body: `
			<h1>Cart</h1>
			<form class="woocommerce-cart-form"><table>${products.filter(({ id }) => quantities.has(id)).map(({ id, price, max }) => `
				<tr class="cart_item"><td><a data-product_id="${id}">Remove</a></td>
				<td class="product-price">$${price}</td>
				<td><input class="qty" type="number" min="1" ${max ? `max="${max}"` : ''} value="${quantities.get(id)}"></td></tr>`).join('')}</table>
				<button type="submit" name="update_cart">Update cart</button>
			</form>
			<p class="cart-subtotal">Subtotal $${subtotal}</p>
			${subtotal < minimum
				? `<div role="alert">Order minimum not met.${showShortfall ? ` Add $${minimum - subtotal} to check out.` : ''}</div>`
				: '<a class="checkout-button" href="/checkout/">Checkout</a>'}
			<script>
				document.querySelector('form').onsubmit = async event => {
					event.preventDefault()
					const overlay = document.createElement('div')
					overlay.className = 'blockUI'
					event.target.append(overlay)
					for (const row of document.querySelectorAll('.cart_item')) {
						const id = +row.querySelector('[data-product_id]').dataset.product_id
						const quantity = +row.querySelector('input').value
						await fetch('/quantity', { method: 'POST', body: JSON.stringify({ id, quantity }) })
					}
					overlay.remove()
				}
			</script>` })
	})
	return quantities
}

const cases = [
	{ name: 'one expensive product can satisfy a target of three', products: [{ id: 1, price: 160 }], target: 3,
		cartPath: '/reservations/', expected: [[1, 1]] },
	{ name: 'quantity increases when a single item is below the minimum', products: [{ id: 1, price: 40, max: 5 }], target: 3,
		cartPath: '/cart/', expected: [[1, 4]] },
	{ name: 'another product covers the shortfall when the server caps quantity',
		products: [{ id: 1, price: 50, stock: 2 }, { id: 2, price: 60, max: 1 }], target: 1,
		cartPath: '/reservations/', expected: [[1, 2], [2, 1]] },
]

for (const { name, products, target, cartPath, expected } of cases) {
	test(name, async ({ page, browserName }, info) => {
		const quantities = await mockStorefront(page, products, 150, cartPath)
		const shop = new ShopPage(page, browserName, info)
		const cart = new CartPage(page, null!, browserName, info, 'recreational')

		await shop.addProductsUntilCheckoutReady(cart, target, 'Pickup', 'recreational', {
			cartButtonDestination: cartPath,
		})

		expect([...quantities]).toEqual(expected)
		await expect(page.locator('.checkout-button')).toBeVisible()
		await expect(page.getByRole('alert')).toBeHidden()
		await expect(page).toHaveURL(`${origin}${cartPath}`)
	})
}

test('fails with the remaining minimum when inventory cannot build a valid cart', async ({ page, browserName }, info) => {
	const waitlistSubmissions: number[] = []
	const quantities = await mockStorefront(page, [
		{ id: 1, price: 40, max: 2 },
		{ id: 2, price: 150, waitlist: true },
	], 150, '/cart/', { waitlistSubmissions })
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')

	await expect(buildListOrderCart(shop, cart, 'Pickup', { allowWaitlist: true }))
		.rejects.toThrow('Add $70 to check out')
	expect([...quantities]).toEqual([[1, 2]])
	expect(waitlistSubmissions).toEqual([])
	await expect(page.locator('.checkout-button')).toBeHidden()
})

test('increases quantity incrementally when the banner omits the shortfall', async ({ page, browserName }, info) => {
	const quantities = await mockStorefront(page, [{ id: 1, price: 40, max: 5 }], 150, '/cart/', { showShortfall: false })
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')
	await buildListOrderCart(shop, cart, 'Pickup')

	expect([...quantities]).toEqual([[1, 4]])
	await expect(page.locator('.checkout-button')).toBeVisible()
})

const regular: Product = { id: 1, price: 150 }
const medicalByTitle: Product = { id: 2, price: 150, medical: 'title' }
const medicalByBadge: Product = { id: 3, price: 150, medical: 'badge' }

for (const usage of ['medical', 'recreational'] as const) {
	test(`List order defaults to four distinct products for a ${usage} customer`, async ({ page, browserName }, info) => {
		const regularProducts = Array.from({ length: 5 }, (_, index) => ({ id: index + 4, price: 50 }))
		const products = [...regularProducts, medicalByBadge]
		const quantities = await mockStorefront(page, products, 150)
		const shop = new ShopPage(page, browserName, info)
		const cart = new CartPage(page, null!, browserName, info, usage)

		await buildListOrderCart(shop, cart, 'Pickup')

		expect([...quantities]).toEqual(usage === 'medical'
			? [[3, 1], [4, 1], [5, 1], [6, 1]]
			: [[4, 1], [5, 1], [6, 1], [7, 1]])
		await expect(page.locator('.checkout-button')).toBeVisible()
	})
}

const eligibilityCases: { name: string; products: Product[]; usage: TestUsageType; target: number; expected: number[] }[] = [
	{ name: 'recreational skips medical badges and card-required titles', products: [medicalByBadge, medicalByTitle, regular],
		usage: 'recreational', target: 3, expected: [1] },
	{ name: 'medical adds medical-only first and also adds regular with a target of one', products: [regular, medicalByTitle],
		usage: 'medical', target: 1, expected: [2, 1] },
	{ name: 'medical can check out with a regular-only menu', products: [regular],
		usage: 'medical', target: 3, expected: [1] },
	{ name: 'medical can check out with a medical-only menu', products: [medicalByBadge],
		usage: 'medical', target: 3, expected: [3] },
]

for (const { name, products, usage, target, expected } of eligibilityCases) {
	test(name, async ({ page, browserName }, info) => {
		const quantities = await mockStorefront(page, products, 150)
		const shop = new ShopPage(page, browserName, info)
		const cart = new CartPage(page, null!, browserName, info, usage)
		await shop.addProductsUntilCheckoutReady(cart, target, 'Pickup', usage)

		expect([...quantities.keys()]).toEqual(expected)
		await expect(page.locator('.checkout-button')).toBeVisible()
	})
}

test('recreational reports ineligible inventory without attempting an add on a medical-only menu', async ({ page, browserName }, info) => {
	const quantities = await mockStorefront(page, [{ ...medicalByTitle, hideAdd: true }], 150)
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')
	await expect(shop.addProductsUntilCheckoutReady(cart, 1, 'Pickup', 'recreational'))
		.rejects.toBeInstanceOf(RecreationalInventoryUnavailableError)
	expect(quantities.size).toBe(0)
})

for (const { usage, fulfillment, expectedId } of [
	{ usage: 'recreational', fulfillment: 'Pickup', expectedId: 1 },
	{ usage: 'medical', fulfillment: 'Delivery', expectedId: 3 },
] as const) {
	test(`production smoke joins the eligible ${fulfillment.toLowerCase()} waitlist for a ${usage} customer`, async ({ page, browserName }, info) => {
		const waitlistSubmissions: number[] = []
		const products = [regular, medicalByBadge].map(product => ({ ...product, waitlist: true }))
		const quantities = await mockStorefront(page, products, 150, '/cart/', { fulfillment, waitlistSubmissions })
		const shop = new ShopPage(page, browserName, info)
		const cart = new CartPage(page, null!, browserName, info, usage)

		await expect(buildListOrderCart(shop, cart, fulfillment, { allowWaitlist: true })).resolves.toBe('waitlist')

		expect(waitlistSubmissions).toEqual([expectedId])
		expect(quantities.size).toBe(0)
		await expect(page).toHaveURL(`${origin}/`)
		await expect(page.getByRole('button', { name: 'On waitlist' })).toBeDisabled()
	})
}

test('production smoke checks out if products are available alongside a waitlist', async ({ page, browserName }, info) => {
	const waitlistSubmissions: number[] = []
	const quantities = await mockStorefront(page, [
		regular, { id: 4, price: 150, waitlist: true },
	], 150, '/cart/', { waitlistSubmissions })
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')

	await expect(buildListOrderCart(shop, cart, 'Pickup', { allowWaitlist: true })).resolves.toBe('checkout')

	expect([...quantities.keys()]).toEqual([regular.id])
	expect(waitlistSubmissions).toEqual([])
	await expect(page.locator('.checkout-button')).toBeVisible()
})

test('production smoke fails when inventory is unavailable and the waitlist is missing', async ({ page, browserName }, info) => {
	await mockStorefront(page, [{ ...regular, hideAdd: true }], 150)
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')

	await expect(buildListOrderCart(shop, cart, 'Pickup', { allowWaitlist: true }))
		.rejects.toBeInstanceOf(ProductInventoryUnavailableError)
})

test('production smoke fails if the storefront rejects the waitlist signup', async ({ page, browserName }, info) => {
	const waitlistSubmissions: number[] = []
	await mockStorefront(page, [{ ...regular, waitlist: true }], 150, '/cart/', {
		waitlistSubmissions,
		rejectWaitlist: true,
	})
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')

	await expect(buildListOrderCart(shop, cart, 'Pickup', { allowWaitlist: true }))
		.rejects.toThrow('Waitlist submission was rejected')
	expect(waitlistSubmissions).toEqual([regular.id])
})

test('checkout-only tests do not join a waitlist', async ({ page, browserName }, info) => {
	const waitlistSubmissions: number[] = []
	await mockStorefront(page, [{ ...regular, waitlist: true }], 150, '/cart/', { waitlistSubmissions })
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')

	await expect(buildListOrderCart(shop, cart, 'Pickup')).rejects.toBeInstanceOf(ProductInventoryUnavailableError)
	expect(waitlistSubmissions).toEqual([])
})
