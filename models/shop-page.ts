import test, { Browser, expect, Locator, Page, TestInfo } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })

export class ShopPage {
	readonly baseUrl: string
	readonly page: Page
	readonly browserName: any
	readonly workerInfo: TestInfo
	readonly addProductButtons
	readonly passwordField: Locator
	readonly lostPasswordLink: Locator
	readonly rememberMeCheckBox: Locator
	readonly loginButton: Locator
	readonly createAccountLink: Locator
	readonly cartTitle: Locator
	constructor(page: Page, browserName: any, workerInfo: TestInfo) {
		this.page = page
		this.browserName = browserName
		this.workerInfo = workerInfo
		this.baseUrl = process.env.BASE_URL
		this.cartTitle = this.page.locator('h1.injected-title:has-text("Cart")')
	}

	async randomizeCartItems() {
		return Math.random() * (2 - -2 + -2)
	}

	async addProductsToCart(
		itemCount: number,
		mobile = false,
		fulfillment = 'Delivery',
		type = 'rec',
	) {
		await test.step('Navigate to Shop page', async () => {
			await this.page.waitForTimeout(3000)
			await this.page.goto('/')
			await this.page.waitForTimeout(3000)
		})
		await test.step('Select Fulfillment Method', async () => {
			if (process.env.NEXT_VERSION === 'true') {
				await this.page.waitForSelector(`label:has-text("${fulfillment}")`)
				await this.page.locator(`label:has-text("${fulfillment}") >> nth=0`).click()
				await this.page.locator('#fulfillerSubmit').click()
				await this.page.waitForTimeout(2000)
				await this.page.reload()
			}
		})
		await test.step('Add Products to Cart', async () => {
			itemCount = itemCount + (await this.randomizeCartItems())
			var products
			await this.page.waitForSelector('.add_to_cart_button')
			products = await this.page.locator('li.product').filter({ hasNotText: 'Sold Out' })

			if (type === 'Recreational') {
				products = products.filter({ hasNot: this.page.locator('span.medOnly') })
			}

			// for (let i = 0; i < itemCount; i++) {
			// 	await test.step(`Add Products # ${i + 1}`, async () => {
			// 		await expect(products.nth(i)).toBeVisible()
			// 		var productCard = products.nth(i)
			// 		var addToCartButton = productCard.locator('a.add_to_cart_button')
			// 		await addToCartButton.click({ force: true })
			// 		await this.page.waitForTimeout(1500)
			// 	})
			// }
			const warning = this.page.locator('p.wcse-warning-button')
			let index = 0
			// Keep adding until the "minimum not met" warning disappears
			while (await warning.isVisible()) {
				const card = products.nth(index % (await products.count()))
				await expect(card).toBeVisible()
				await card.locator('a.add_to_cart_button').click({ force: true })
				await this.page.waitForTimeout(1500)
				index++
			}
			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			if (this.workerInfo.project.name === 'Mobile Chrome') {
				await this.page.locator(`.footer-cart-contents`).first().click({ force: true })
			} else {
				if (
					process.env.BASE_URL === 'https://thelist.theflowery.co/' ||
					process.env.BASE_URL === 'https://thelist-co.710labs.com/' ||
					process.env.BASE_URL === 'https://thelist-mi.710labs.com/'
				) {
					await this.page
						.locator(`[href="${process.env.BASE_URL}reservations/"]`)
						.first()
						.click({ force: true })
				} else {
					await this.page
						.locator(`[href="${process.env.BASE_URL}cart/"]`)
						.first()
						.click({ force: true })
				}
			}
		})
	}
	async addSameProductToCart(itemCount: number) {
		await test.step('Add Products to Cart', async () => {
			await this.page.waitForSelector('[aria-label*="Add to cart:"]')

			const addToCartButtons = await this.page
				.locator('[aria-label*="Add to cart:"]')
				.elementHandles()

			for (let i = 0; i < itemCount; i++) {
				await addToCartButtons[0].click()
				await this.page.waitForTimeout(750)
			}
			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			await this.page.locator(``).first().click({ force: true })
		})
	}
	async addProductListToCart(orderList: string[]) {
		for (let index = 0; index < orderList.length; index++) {
			await test.step(`Add ${orderList[index]} to Cart`, async () => {
				await this.page
					.locator(`[data-product_sku*='${orderList[index]}']`)
					.first()
					.scrollIntoViewIfNeeded()
				await this.page.locator(`[data-product_sku*='${orderList[index]}']`).first().click()
				await this.page.waitForTimeout(2000)
			})
		}
		await this.page.waitForTimeout(5000)
	}
	async goToCart() {
		if (this.workerInfo.project.name === 'Mobile Chrome') {
			await this.page.locator(`.footer-cart-contents`).first().click({ force: true })
		} else {
			if (process.env.BASE_URL === 'https://thelist.theflowery.co/') {
				await this.page
					.locator(`[href="${process.env.BASE_URL}reservations/"]`)
					.first()
					.click({ force: true })
			} else if (process.env.BASE_URL === 'https://thelist-mi.710labs.com/') {
				// Retry loop to ensure cart page loads
				let retryCount = 0
				const maxRetries = 5
				while (retryCount < maxRetries) {
					console.log(`Attempting to navigate to cart, attempt ${retryCount + 1}/${maxRetries}`)
					await this.page
						.locator(`a.cart-contents[title="View your shopping cart"]`)
						.first()
						.click({ force: true })
					// Wait a moment for the page to respond
					await this.page.waitForTimeout(3000)
					// Check if cart title is visible
					const isCartTitleVisible = await this.cartTitle.isVisible()
					if (isCartTitleVisible) {
						console.log(`Cart page loaded successfully after ${retryCount + 1} attempt(s)`)
						break
					}
					retryCount++
					console.log(`Cart title not visible, retry ${retryCount}/${maxRetries}`)
					if (retryCount === maxRetries) {
						throw new Error(`Cart page did not load after ${maxRetries} attempts`)
					}
				}
				// Final confirmation that cart title is present
				await this.cartTitle.waitFor({ timeout: 30000 })
			} else {
				await this.page
					.locator(`[href="${process.env.BASE_URL}cart/"]`)
					.first()
					.click({ force: true })
			}
		}
	}

	async addProductsToCartPickup(
		itemCount: number,
		mobile = false,
		fulfillment = 'Pickup',
		type = 'Recreational',
	) {
		await test.step('Navigate to Shop page', async () => {
			await this.page.waitForTimeout(3000)
			await this.page.goto('/')
			await this.page.waitForTimeout(3000)
		})
		await test.step('Select Fulfillment Method', async () => {
			if (process.env.NEXT_VERSION === 'true') {
				await this.page.waitForSelector(`label:has-text("${fulfillment}")`)
				await this.page.locator(`label:has-text("${fulfillment}") >> nth=0`).click()
				await this.page.locator('#fulfillerSubmit').click()
				await this.page.waitForTimeout(2000)
				await this.page.reload()
			}
		})
		await test.step('Add Products to Cart', async () => {
			itemCount = itemCount + (await this.randomizeCartItems())
			var products
			await this.page.waitForSelector('.add_to_cart_button')
			products = await this.page.locator('li.product').filter({ hasNotText: 'Sold Out' })

			if (type === 'Recreational') {
				products = await products.filter({ hasNot: this.page.locator('span.medOnly') })
			}

			for (let i = 0; i < itemCount; i++) {
				await test.step(`Add Products # ${i + 1}`, async () => {
					await expect(products.nth(i)).toBeVisible()
					var productCard = products.nth(i)
					var addToCartButton = productCard.locator('a.add_to_cart_button')
					await addToCartButton.click({ force: true })
					await this.page.waitForTimeout(1500)
				})
			}

			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			if (this.workerInfo.project.name === 'Mobile Chrome') {
				await this.page.locator(`.footer-cart-contents`).first().click({ force: true })
			} else {
				if (process.env.BASE_URL === 'https://thelist.theflowery.co/') {
					await this.page
						.locator(`[href="${process.env.BASE_URL}reservations/"]`)
						.first()
						.click({ force: true })
				} else {
					await this.page
						.locator(`[href="${process.env.BASE_URL}cart/"]`)
						.first()
						.click({ force: true })
				}
			}
		})
	}
}
