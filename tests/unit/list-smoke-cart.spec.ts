import { expect, test, type Page } from '@playwright/test'
import { CartPage } from '../../models/cart-page'
import { ShopPage } from '../../models/shop-page'

const origin = 'https://list-smoke-cart.test'
test.use({ baseURL: origin })

type Product = { id: number; price: number; max?: number; stock?: number }

async function mockStorefront(page: Page, products: Product[], minimum: number, cartPath = '/cart/', showShortfall = true) {
	const quantities = new Map<number, number>()
	await page.route(`${origin}/**`, async route => {
		const { pathname } = new URL(route.request().url())
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
				<button class="wcse-nav">Pickup</button>
				<a class="cart-contents" href="${cartPath}">Cart (${[...quantities.values()].reduce((sum, value) => sum + value, 0)})</a>
				<ul>${products.map(({ id, price }) => `<li class="product"><h2>Product ${id}</h2>
					<span class="price">$${price}</span><button class="add_to_cart_button" data-product_id="${id}">Add</button></li>`).join('')}</ul>
				<script>
					for (const button of document.querySelectorAll('.add_to_cart_button')) {
						button.onclick = async () => {
							const response = await fetch('/add', { method: 'POST', body: JSON.stringify({ id: +button.dataset.product_id, quantity: 1 }) })
							document.querySelector('.cart-contents').textContent = 'Cart (' + (await response.json()).count + ')'
						}
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

		await shop.addProductsUntilCheckoutReady(cart, target, 'Pickup', 'recreational', cartPath)

		expect([...quantities]).toEqual(expected)
		await expect(page.locator('.checkout-button')).toBeVisible()
		await expect(page.getByRole('alert')).toBeHidden()
		await expect(page).toHaveURL(`${origin}${cartPath}`)
	})
}

test('fails with the remaining minimum when inventory cannot build a valid cart', async ({ page, browserName }, info) => {
	const quantities = await mockStorefront(page, [{ id: 1, price: 40, max: 2 }], 150)
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')

	await expect(shop.addProductsUntilCheckoutReady(cart, 3, 'Pickup', 'recreational', '/cart/'))
		.rejects.toThrow('Add $70 to check out')
	expect([...quantities]).toEqual([[1, 2]])
	await expect(page.locator('.checkout-button')).toBeHidden()
})

test('increases quantity incrementally when the banner omits the shortfall', async ({ page, browserName }, info) => {
	const quantities = await mockStorefront(page, [{ id: 1, price: 40, max: 5 }], 150, '/cart/', false)
	const shop = new ShopPage(page, browserName, info)
	const cart = new CartPage(page, null!, browserName, info, 'recreational')
	await shop.addProductsUntilCheckoutReady(cart, 3, 'Pickup', 'recreational')

	expect([...quantities]).toEqual([[1, 4]])
	await expect(page.locator('.checkout-button')).toBeVisible()
})
