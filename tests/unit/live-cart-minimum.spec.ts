import { expect, test } from '@playwright/test'
import { LiveNonProdCartFlow } from '../../models/always-on/live-nonprod-cart-flow.ts'

const origin = 'https://live-cart-minimum.test'

function storefrontPage(
	pathname: string,
	initialCart = ['Registration Flower'],
	withMedicalCandidate = false,
) {
	const cartPage = pathname === '/cart/' || pathname === '/cart'
	const checkoutPage = pathname === '/checkout/'
	const products = [
		{ id: '1', name: 'Registration Flower', price: 10 },
		{ id: '2', name: 'Second Flower', price: 20 },
		{ id: '3', name: 'Third Flower', price: 20 },
	]

	return `
		<html>
			<head>
				<style>
					.wpse-drawer {
						position: fixed;
						top: 0;
						right: 0;
						width: 320px;
						height: 100vh;
						background: white;
					}
				</style>
			</head>
			<body>
				<a class="wpse-cart-openerize" href="#">View cart</a>
				${cartPage ? '<h1>Cart</h1>' : ''}
				${checkoutPage ? '<h1>Checkout</h1>' : ''}
				${
					pathname === '/shop/artist-tree/'
						? `<ul>${products
								.map(
									product => `
										<li class="product type-product">
											<h2 class="woocommerce-loop-product__title">${product.name}</h2>
											<p class="product-subheading">Deli Flower</p>
											${withMedicalCandidate && product.id === '2' ? '<span class="wpse-metabadge med-metabadge">Medical Only</span>' : ''}
											<a href="/shop/artist-tree/">The Artist Tree</a>
											<button class="fasd_to_cart" data-id="${product.id}" data-instance="1" data-facility="6" data-method="pickup" data-name="${product.name}">Add to cart</button>
										</li>`,
								)
								.join('')}</ul>`
						: ''
				}
				<div class="wpse-drawer" data-module="cart" style="display: ${cartPage ? 'block' : 'none'}">
					<button class="wpse-button-mobsaf wpse-button-close wpse-closerizer">Close</button>
					<div id="cartDrawer">
						<a href="/shop/artist-tree/">The Artist Tree</a>
						<table><tbody id="cartItems"></tbody></table>
						<a href="/shop/artist-tree/">Add more items</a>
						<div id="cartMinimum"></div>
						<a id="cartView" class="button wpse-cart-openerize" href="/cart" data-module="cart">View Cart</a>
						<a id="cartCheckout" class="checkout-button button alt wc-forward" href="/checkout/">Checkout</a>
					</div>
				</div>
				<div class="wpse-drawer" data-module="cart-response" style="display: none">
					<button class="wpse-button-mobsaf wpse-button-close wpse-closerizer">Close</button>
					<div id="radicalResponseCart">
						<p id="responseProduct"></p>
						<div id="responseMinimum"></div>
						<a id="responseView" href="/cart">View Cart</a>
					</div>
				</div>
				<script>
					const prices = ${JSON.stringify(Object.fromEntries(products.map(p => [p.name, p.price])))}
					const cart = JSON.parse(sessionStorage.getItem('cart') || '${JSON.stringify(initialCart)}')
					sessionStorage.setItem('cart', JSON.stringify(cart))
					const cartDrawer = document.querySelector('[data-module="cart"]')
					const responseDrawer = document.querySelector('[data-module="cart-response"]')
					const warning = total => total < 50
						? '<div><strong>Order minimum not met</strong><span>Add $' + (50 - total) + ' to check out.</span></div>'
						: ''
					function renderCart() {
						const total = cart.reduce((sum, name) => sum + prices[name], 0)
						document.querySelector('#cartItems').innerHTML = cart.map(name => '<tr class="cart_item"><td class="product-name"><a>' + name + '</a></td></tr>').join('')
						document.querySelector('#cartMinimum').innerHTML = warning(total)
						document.querySelector('#responseMinimum').innerHTML = warning(total)
						document.querySelector('#cartView').style.display = total >= 50 ? 'block' : 'none'
						document.querySelector('#responseView').style.display = total >= 50 ? 'block' : 'none'
						document.querySelector('#cartCheckout').style.display = total >= 50 ? 'block' : 'none'
					}
					renderCart()
					document.querySelector('a.wpse-cart-openerize').addEventListener('click', event => {
						event.preventDefault()
						cartDrawer.style.display = 'block'
					})
					document.querySelectorAll('.wpse-button-close').forEach(button => {
						button.addEventListener('click', () => {
							button.closest('.wpse-drawer').style.display = 'none'
						})
					})
					document.querySelectorAll('button.fasd_to_cart').forEach(button => {
						button.addEventListener('click', () => {
							const name = button.dataset.name
							const attempts = JSON.parse(sessionStorage.getItem('attempts') || '[]')
							attempts.push(name)
							sessionStorage.setItem('attempts', JSON.stringify(attempts))
							cart.push(name)
							sessionStorage.setItem('cart', JSON.stringify(cart))
							renderCart()
							document.querySelector('#responseProduct').textContent = name
							cartDrawer.style.display = 'none'
							responseDrawer.style.display = 'block'
						})
					})
				</script>
			</body>
		</html>
	`
}

for (const userType of ['rec', 'med'] as const) {
	test(`${userType.toUpperCase()} keeps the registration item and shops until the minimum banner disappears`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 393, height: 851 })
		await page.route(`${origin}/**`, async route => {
			await route.fulfill({
				contentType: 'text/html',
				body: storefrontPage(new URL(route.request().url()).pathname),
			})
		})
		await page.goto(`${origin}/`)

		const cartFlow = new LiveNonProdCartFlow(page)
		await cartFlow.addProductsUntilCheckout(userType)

		await expect(page).toHaveURL(`${origin}/checkout/`)
		expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('cart') || '[]'))).toEqual([
			'Registration Flower',
			'Second Flower',
			'Third Flower',
		])
		expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('attempts') || '[]'))).toEqual([
			'Second Flower',
			'Third Flower',
		])
	})
}

test('checks out without adding another item when the registration cart already meets the minimum', async ({
	page,
}) => {
	const initialCart = ['Registration Flower', 'Second Flower', 'Third Flower']
	await page.route(`${origin}/**`, async route => {
		await route.fulfill({
			contentType: 'text/html',
			body: storefrontPage(new URL(route.request().url()).pathname, initialCart),
		})
	})
	await page.goto(`${origin}/`)

	const cartFlow = new LiveNonProdCartFlow(page)
	await cartFlow.addProductsUntilCheckout('rec')

	await expect(page).toHaveURL(`${origin}/checkout/`)
	expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('cart') || '[]'))).toEqual(
		initialCart,
	)
	expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('attempts') || '[]'))).toEqual(
		[],
	)
})

test('MED adds a medical-only product before checkout even when the registration cart meets the minimum', async ({
	page,
}) => {
	const initialCart = ['Registration Flower', 'Third Flower', 'Third Flower']
	await page.route(`${origin}/**`, async route => {
		await route.fulfill({
			contentType: 'text/html',
			body: storefrontPage(new URL(route.request().url()).pathname, initialCart, true),
		})
	})
	await page.goto(`${origin}/`)

	const cartFlow = new LiveNonProdCartFlow(page)
	const result = await cartFlow.addProductsUntilCheckout('med')

	await expect(page).toHaveURL(`${origin}/checkout/`)
	expect(result.medicalProductAdded).toBe(true)
	expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('attempts') || '[]'))).toEqual([
		'Second Flower',
	])
})
