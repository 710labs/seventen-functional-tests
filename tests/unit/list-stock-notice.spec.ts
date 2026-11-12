import test, { expect } from '@playwright/test'
import { ShopPage } from '../../models/shop-page'

test.use({ baseURL: 'https://list-stock.test' })

test('dismisses a stock rejection and adds a different product without reloading the shop', async ({ page }, info) => {
	const addAttempts: string[] = []
	const cartProducts: string[] = []
	let shopLoads = 0
	await page.route('https://list-stock.test/', route => {
		shopLoads += 1
		return route.fulfill({
			contentType: 'text/html',
			body: `
				<button class="wcse-nav">Delivery</button>
				<a href="/cart/">Cart (0)</a>
				<ul>
					<li class="product"><h2>Piescream #7</h2><span class="price">$39</span>
						<button class="add_to_cart_button" data-product_id="101">Add</button></li>
					<li class="product"><h2>Rainbow Belts</h2><span class="price">$39</span>
						<button class="add_to_cart_button" data-product_id="202">Add</button></li>
				</ul>
				<div class="notyf" hidden style="position: fixed; inset: 0; background: #0008">
					<div class="notyf__wrapper">
						<div class="notyf__message"><li data-added_by_reserved_stock_pro="1">
							Cannot add 1 × Piescream #7. There are only 0 left.
						</li></div>
						<div class="notyf__dismiss"><button class="notyf__dismiss-btn">×</button></div>
					</div>
				</div>
				<script>
					const toast = document.querySelector('.notyf')
					toast.querySelector('button').onclick = () => {
						toast.hidden = true
						sessionStorage.setItem('dismissed-stock-notice', 'true')
					}
					for (const button of document.querySelectorAll('.add_to_cart_button')) {
						button.onclick = async () => {
							const response = await fetch('/add', { method: 'POST', body: button.dataset.product_id })
							if (response.status === 409) toast.hidden = false
							else document.querySelector('a').textContent = 'Cart (1)'
						}
					}
				</script>`,
		})
	})
	await page.route('https://list-stock.test/add', route => {
		const productId = route.request().postData()!
		addAttempts.push(productId)
		if (productId === '101') return route.fulfill({ status: 409 })
		cartProducts.push('Rainbow Belts')
		return route.fulfill({ status: 200 })
	})
	await page.route('https://list-stock.test/cart/', route => route.fulfill({
		contentType: 'text/html',
		body: cartProducts.map(product => `<div class="cart_item">${product}</div>`).join(''),
	}))

	const shop = new ShopPage(page, 'chromium', info)
	await shop.addProductsToCart(1, false, 'Delivery', 'recreational', { exactItemCount: true })

	expect(addAttempts).toEqual(['101', '202'])
	expect(shopLoads).toBe(1)
	expect(await page.evaluate(() => sessionStorage.getItem('dismissed-stock-notice'))).toBe('true')
	await expect(page.locator('.cart_item')).toHaveText(['Rainbow Belts'])
})
