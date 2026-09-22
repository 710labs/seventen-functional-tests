import { expect, Page, test } from '@playwright/test'
import { LiveNonProdHomePageActions } from '../../models/always-on/live-nonprod-homepage-actions.ts'
import {
	isInsufficientInventoryNotice,
	selectFirstAvailableDeliFlowerPortion,
} from '../../models/always-on/product-portions.ts'

async function setPortionMarkup(page: Page) {
	await page.setContent(`
		<fieldset class="fasd-portion-set" data-portion-group="portionId_pickup_1">
			<label>
				<input
					type="radio"
					class="fasd-portion-radio"
					name="portionId_pickup_1"
					data-weight-label="28g"
				/>
				Ounce
			</label>
			<label>
				<input
					type="radio"
					class="fasd-portion-radio"
					name="portionId_pickup_1"
					data-weight-label="14g"
				/>
				Half
			</label>
		</fieldset>
		<button data-portion-group="portionId_pickup_1" disabled>Add to cart</button>
		<script>
			document.querySelectorAll('.fasd-portion-radio').forEach(portion => {
				portion.addEventListener('change', () => {
					document.querySelector('button').disabled = false
				})
			})
		</script>
	`)
}

test.describe('Deli Flower product portions', () => {
	test('clicks the first enabled weight label before adding Deli Flower', async ({ page }) => {
		await setPortionMarkup(page)
		const addToCart = page.getByRole('button', { name: 'Add to cart' })

		const selectedPortion = await selectFirstAvailableDeliFlowerPortion(
			page,
			addToCart,
			'Z',
		)

		expect(selectedPortion).toBe('Ounce')
		await expect(page.getByRole('radio').first()).toBeChecked()
		await expect(addToCart).toBeEnabled()
	})

	test('clicks the next weight label when the first option is disabled', async ({ page }) => {
		await setPortionMarkup(page)
		await page.getByRole('radio').first().evaluate(input => {
			;(input as HTMLInputElement).disabled = true
		})
		const addToCart = page.getByRole('button', { name: 'Add to cart' })

		const selectedPortion = await selectFirstAvailableDeliFlowerPortion(
			page,
			addToCart,
			'Z',
		)

		expect(selectedPortion).toBe('Half')
		await expect(page.getByRole('radio').nth(1)).toBeChecked()
		await expect(addToCart).toBeEnabled()
	})

	test('selects another enabled label when the first radio remains checked', async ({ page }) => {
		await setPortionMarkup(page)
		const firstPortion = page.getByRole('radio').first()
		await firstPortion.check()
		const addToCart = page.getByRole('button', { name: 'Add to cart' })
		await addToCart.evaluate(button => {
			;(button as HTMLButtonElement).disabled = true
		})

		const selectedPortion = await selectFirstAvailableDeliFlowerPortion(
			page,
			addToCart,
			'Z',
		)

		expect(selectedPortion).toBe('Half')
		await expect(page.getByRole('radio').nth(1)).toBeChecked()
		await expect(addToCart).toBeEnabled()
	})

	test('does not select a portion when the product has no portion group', async ({ page }) => {
		await page.setContent('<button>Add to cart</button>')
		const addToCart = page.getByRole('button', { name: 'Add to cart' })

		expect(
			await selectFirstAvailableDeliFlowerPortion(
				page,
				addToCart,
				'Rambutan #11',
			),
		).toBeNull()
		await expect(page.getByRole('radio')).toHaveCount(0)
		await expect(addToCart).toBeEnabled()
	})
})

test('re-adds the current Deli Flower product after registration', async ({ page }) => {
	await page.setContent(`
		<a class="wpse-cart-openerize">View cart</a>
		<div class="summary entry-summary">
			<h1 class="product_title entry-title">Z</h1>
			<p class="product-subheading">Deli Flower</p>
			<fieldset data-portion-group="portionId_pickup_80534_8_1">
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portionId_pickup_80534_8_1"
						data-weight-label="28g"
					/>
					Ounce
				</label>
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portionId_pickup_80534_8_1"
						data-weight-label="14g"
					/>
					Half
				</label>
			</fieldset>
			<button data-portion-group="portionId_pickup_80534_8_1" disabled>Add to cart</button>
		</div>
		<div id="cartDrawer" style="display: none">
			<p>Z</p>
		</div>
		<script>
			document.querySelectorAll('.fasd-portion-radio').forEach(portion => {
				portion.addEventListener('change', () => {
					document.querySelector('button').disabled = false
				})
			})
			document.querySelector('button').addEventListener('click', () => {
				document.querySelector('#cartDrawer').style.display = 'block'
			})
		</script>
	`)

	const homePageActions = new LiveNonProdHomePageActions(page)
	await homePageActions.addCurrentProductToCartAfterRegistration(page)

	await expect(page.getByRole('radio').first()).toBeChecked()
	await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
	await expect(page.locator('#cartDrawer')).toBeVisible()
	await expect(page.locator('#cartDrawer')).toContainText('Z')
})

test('does not re-add the product when the cart survives registration', async ({ page }) => {
	await page.setContent(`
		<a class="wpse-cart-openerize">View cart <span>1</span></a>
		<div class="summary entry-summary">
			<h1 class="product_title entry-title">Z</h1>
			<fieldset data-portion-group="portionId_pickup_80534_8_1">
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portionId_pickup_80534_8_1"
						data-weight-label="28g"
					/>
					Ounce
				</label>
			</fieldset>
			<button data-portion-group="portionId_pickup_80534_8_1" disabled>Add to cart</button>
		</div>
		<div class="wpse-drawer" data-module="cart-response">
			<p>Z</p>
		</div>
		<script>
			window.addClicks = 0
			document.querySelector('button').addEventListener('click', () => {
				window.addClicks += 1
			})
		</script>
	`)

	const homePageActions = new LiveNonProdHomePageActions(page)
	await homePageActions.addCurrentProductToCartAfterRegistration(page)

	await expect(page.getByRole('radio')).not.toBeChecked()
	expect(
		await page.evaluate(
			() => (window as typeof window & { addClicks: number }).addClicks,
		),
	).toBe(0)
	await expect(page.locator('.wpse-drawer[data-module="cart-response"]')).toContainText('Z')
})

test('recognizes the Live low-inventory banner text', () => {
	expect(
		isInsufficientInventoryNotice(
			'Not enough available Only 12g of this product is left.',
		),
	).toBe(true)
	expect(isInsufficientInventoryNotice('Added to your cart')).toBe(false)
})

test('returns to registration before inspecting simultaneous cart warnings', async ({ page }) => {
	const openedProductPaths: string[] = []
	const productPage = (name: string, hasInventory: boolean) => `
		<a class="wpse-cart-openerize">View cart</a>
		<div class="summary entry-summary">
			<h1 class="product_title entry-title">${name}</h1>
			<p class="product-subheading">Deli Flower</p>
			<button>Add to cart</button>
		</div>
		<div class="wpse-drawer" data-module="cart-response" style="display: none">
			<div class="wpse-snacktoast warn-toast">
				<span class="wpse-snacktoast-icon"></span>
				<span class="wpse-snacktoast-msg">
					<span class="wpse-snacktoast-headline">Not enough available</span>
					<span class="wpse-snacktoast-desc">Only 12g of this product is left.</span>
				</span>
			</div>
		</div>
		<div class="wpse-drawer" data-module="cart-conflict" style="display: none">
			<h3>Start a new cart?</h3>
			<button>Keep my cart</button>
		</div>
		<section class="wpse-component">
			<div id="renderGateway" style="display: none">
				<label>Email <input type="email" /></label>
				<button>Continue</button>
			</div>
		</section>
		<div id="cartDrawer" style="display: none"></div>
		<script>
			document.querySelector('button').addEventListener('click', () => {
				if (${hasInventory}) {
					document.querySelector('#cartDrawer').textContent = '${name}'
					document.querySelector('#cartDrawer').style.display = 'block'
				} else {
					document.querySelector('[data-module="cart-response"]').style.display = 'block'
					document.querySelector('[data-module="cart-conflict"]').style.display = 'block'
					document.querySelector('#renderGateway').style.display = 'block'
				}
			})
		</script>
	`

	await page.route('https://initial-add.test/**', async route => {
		const pathname = new URL(route.request().url()).pathname

		if (pathname === '/shop/') {
			await route.fulfill({
				contentType: 'text/html',
				body: `
					<ul class="products">
						<li class="product type-product">
							<a class="woocommerce-loop-product__link" href="https://initial-add.test/product/featured/">
								<h2 class="woocommerce-loop-product__title">Featured</h2>
							</a>
							<p class="product-subheading">Deli Flower</p>
						</li>
						<li class="product type-product">
							<a class="woocommerce-loop-product__link" href="https://initial-add.test/product/low/">
								<h2 class="woocommerce-loop-product__title">Low Inventory</h2>
							</a>
							<p class="product-subheading">Deli Flower</p>
						</li>
						<li class="product type-product">
							<a class="woocommerce-loop-product__link" href="https://initial-add.test/product/concentrate/">
								<h2 class="woocommerce-loop-product__title">Concentrate</h2>
							</a>
							<p class="product-subheading">Concentrates</p>
						</li>
						<li class="product type-product">
							<a class="woocommerce-loop-product__link" href="https://initial-add.test/product/in-stock/">
								<h2 class="woocommerce-loop-product__title">In Stock</h2>
							</a>
							<p class="product-subheading">Deli Flower</p>
						</li>
					</ul>
				`,
			})
			return
		}

		openedProductPaths.push(pathname)

		const productName =
			pathname === '/product/low/'
				? 'Low Inventory'
				: pathname === '/product/concentrate/'
					? 'Concentrate'
					: 'In Stock'
		await route.fulfill({
			contentType: 'text/html',
			body: productPage(productName, pathname === '/product/in-stock/'),
		})
	})

	await page.goto('https://initial-add.test/shop/')
	const homePageActions = new LiveNonProdHomePageActions(page)
	await homePageActions.addSingleProductToCart(page)

	await expect(page).toHaveURL('https://initial-add.test/product/low/')
	await expect(page.locator('section.wpse-component #renderGateway')).toBeVisible()
	await expect(page.locator('.wpse-drawer[data-module="cart-conflict"]')).toBeVisible()
	await expect(page.locator('.wpse-snacktoast.warn-toast')).toContainText('Not enough available')
	expect(openedProductPaths).toEqual(['/product/low/'])
})

test('retries the next Deli Flower product after an inventory rejection', async ({ page }) => {
	const listingUrl = 'https://live.test/shop/beverly-hills/'
	const productPage = (name: string, slug: string, hasInventory: boolean) => `
		<a class="wpse-cart-openerize">View cart</a>
		<div class="summary entry-summary">
			<h1 class="product_title entry-title">${name}</h1>
			<p class="product-subheading">Deli Flower</p>
			<fieldset data-portion-group="portion_${slug}">
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portion_${slug}"
						data-weight-label="14g"
					/>
					Half
				</label>
			</fieldset>
			<button data-portion-group="portion_${slug}" disabled>Add to cart</button>
		</div>
		<div class="wpse-drawer" data-module="cart-response" style="display: none">
			<div class="wpse-snacktoast warn-toast">
				<span class="wpse-snacktoast-icon"></span>
				<span class="wpse-snacktoast-msg">
					<span class="wpse-snacktoast-headline">Not enough available</span>
					<span class="wpse-snacktoast-desc">Only 12g of this product is left.</span>
				</span>
			</div>
		</div>
		<div id="cartDrawer" style="display: none"></div>
		<script>
			document.querySelector('.fasd-portion-radio').addEventListener('change', () => {
				document.querySelector('button').disabled = false
			})
			document.querySelector('button').addEventListener('click', () => {
				if (${hasInventory}) {
					document.querySelector('.wpse-cart-openerize').textContent = 'View cart 1'
					document.querySelector('#cartDrawer').textContent = '${name}'
					document.querySelector('#cartDrawer').style.display = 'block'
				} else {
					document.querySelector('[data-module="cart-response"]').style.display = 'block'
				}
			})
		</script>
	`

	await page.route('https://live.test/**', async route => {
		const pathname = new URL(route.request().url()).pathname

		if (pathname === '/shop/beverly-hills/') {
			await route.fulfill({
				contentType: 'text/html',
				body: `
					<ul class="products">
						<li class="product type-product">
							<a class="woocommerce-loop-product__link" href="https://live.test/product/featured/">
								<h2 class="woocommerce-loop-product__title">Featured</h2>
							</a>
							<p class="product-subheading">Deli Flower</p>
						</li>
						<li class="product type-product">
							<a class="woocommerce-loop-product__link" href="https://live.test/product/low-one/">
								<h2 class="woocommerce-loop-product__title">Low One</h2>
							</a>
							<p class="product-subheading">Deli Flower</p>
						</li>
						<li class="product type-product">
							<a class="woocommerce-loop-product__link" href="https://live.test/product/low-two/">
								<h2 class="woocommerce-loop-product__title">Low Two</h2>
							</a>
							<p class="product-subheading">Deli Flower</p>
						</li>
						<li class="product type-product">
							<a class="woocommerce-loop-product__link" href="https://live.test/product/in-stock/">
								<h2 class="woocommerce-loop-product__title">In Stock</h2>
							</a>
							<p class="product-subheading">Deli Flower</p>
						</li>
					</ul>
				`,
			})
			return
		}

		if (pathname === '/product/low-one/') {
			await route.fulfill({
				contentType: 'text/html',
				body: productPage('Low One', 'low_one', false),
			})
			return
		}

		if (pathname === '/product/low-two/') {
			await route.fulfill({
				contentType: 'text/html',
				body: productPage('Low Two', 'low_two', false),
			})
			return
		}

		await route.fulfill({
			contentType: 'text/html',
			body: productPage('In Stock', 'in_stock', true),
		})
	})

	await page.goto(listingUrl)
	await page.goto('https://live.test/product/low-one/')

	const homePageActions = new LiveNonProdHomePageActions(page)
	await homePageActions.addCurrentProductToCartAfterRegistration(page)

	await expect(page).toHaveURL('https://live.test/product/in-stock/')
	await expect(page.locator('#cartDrawer')).toBeVisible()
	await expect(page.locator('#cartDrawer')).toContainText('In Stock')
})
