import { expect, test } from '@playwright/test'
import { ShopPage } from '../../models/shop-page'

const origin = 'https://list-reservations.test'
test.use({ baseURL: origin })

test('fills the cart and follows the storefront cart button to reservations', async ({ page }, info) => {
	const products = ['Thumbprint', 'Flower', 'Rosin']
	const visitedPaths: string[] = []
	await page.route(`${origin}/**`, route => {
		const { pathname } = new URL(route.request().url())
		visitedPaths.push(pathname)

		if (pathname === '/reservations/') {
			return route.fulfill({
				contentType: 'text/html',
				body: `<h1>Cart</h1><main id="cart"></main><script>
					const cart = JSON.parse(sessionStorage.getItem('cart') || '[]')
					for (const product of cart) {
						const row = document.createElement('div')
						row.className = 'cart_item'
						row.textContent = product
						document.querySelector('#cart').append(row)
					}
				</script>`,
			})
		}

		if (pathname !== '/') return route.fulfill({ status: 404 })
		return route.fulfill({
			contentType: 'text/html',
			body: `
				<button class="wcse-nav">Pickup</button>
				<a class="cart-contents" href="/cart/">Cart (0)</a>
				<ul>${products.map((name, index) => `
					<li class="product"><h2>${name}</h2><span class="price">$120</span>
						<button class="add_to_cart_button" data-product_id="${index + 1}">Add</button></li>`).join('')}
				</ul>
				<script>
					const cart = []
					const cartButton = document.querySelector('.cart-contents')
					for (const button of document.querySelectorAll('.add_to_cart_button')) {
						button.onclick = () => {
							cart.push(button.closest('li').querySelector('h2').textContent)
							cartButton.textContent = 'Cart (' + cart.length + ')'
						}
					}
					cartButton.onclick = event => {
						event.preventDefault()
						sessionStorage.setItem('cart', JSON.stringify(cart))
						location.assign('/reservations/#')
					}
				</script>`,
		})
	})

	const shop = new ShopPage(page, 'chromium', info)
	await shop.addProductsToCart(3, false, 'Pickup', 'recreational', {
		exactItemCount: true,
		cartButtonDestination: '/reservations',
	})

	expect(visitedPaths).toEqual(['/', '/reservations/'])
	await expect(page.locator('.cart_item')).toHaveText(products)
})
