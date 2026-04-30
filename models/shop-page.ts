import test, { Browser, expect, Locator, Page, TestInfo } from '@playwright/test'
require('dotenv').config({ path: require('find-config')('.env') })
import { isMedicalUsage, type TestUsageType } from '../utils/usage-types'

type GoToCartOptions = {
	requireItems?: boolean
}

type CartLoadState = {
	hasCartItem: boolean
	hasCheckoutButton: boolean
	hasCartTitle: boolean
	hasEmptyCartText: boolean
	url: string
}

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

	private getCartPath() {
		if (process.env.BASE_URL === 'https://thelist.theflowery.co/') {
			return '/reservations/'
		}

		return '/cart/'
	}

	private async getCartLoadState(): Promise<CartLoadState> {
		return {
			hasCartItem: await this.page
				.locator('.cart_item')
				.first()
				.isVisible()
				.catch(() => false),
			hasCheckoutButton: await this.page
				.locator('.checkout-button')
				.first()
				.isVisible()
				.catch(() => false),
			hasCartTitle: await this.page
				.locator('h1:has-text("Cart"), h1.injected-title:has-text("Cart")')
				.first()
				.isVisible()
				.catch(() => false),
			hasEmptyCartText: await this.page
				.getByText(/cart is currently empty/i)
				.first()
				.isVisible()
				.catch(() => false),
			url: this.page.url(),
		}
	}

	private async waitForCartLoaded(options: GoToCartOptions = {}) {
		const deadline = Date.now() + 30_000
		let lastState: CartLoadState | null = null

		while (Date.now() < deadline) {
			lastState = await this.getCartLoadState()

			if (options.requireItems) {
				if (lastState.hasCartItem || lastState.hasCheckoutButton) {
					return
				}
			} else if (
				lastState.hasCartItem ||
				lastState.hasCheckoutButton ||
				lastState.hasCartTitle ||
				lastState.hasEmptyCartText
			) {
				return
			}

			await this.page.waitForTimeout(500)
		}

		const bodyText = await this.page
			.locator('body')
			.innerText({ timeout: 1000 })
			.catch(() => '')
		const bodyPreview = bodyText.replace(/\s+/g, ' ').trim().slice(0, 500)

		throw new Error(
			[
				`Cart page did not load within 30000ms after navigating to ${this.getCartPath()}.`,
				`Current URL: ${lastState?.url || this.page.url()}`,
				`Cart item visible: ${lastState?.hasCartItem ?? false}`,
				`Checkout button visible: ${lastState?.hasCheckoutButton ?? false}`,
				`Cart title visible: ${lastState?.hasCartTitle ?? false}`,
				`Empty cart text visible: ${lastState?.hasEmptyCartText ?? false}`,
				`Body preview: ${bodyPreview}`,
			].join('\n'),
		)
	}

	async addProductsToCart(
		itemCount: number,
		mobile = false,
		fulfillment = 'Delivery',
		usage: TestUsageType = 'recreational',
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

			if (!isMedicalUsage(usage)) {
				products = products.filter({ hasNot: this.page.locator('span.medOnly') })
			}

			let broke = false
			for (let i = 0; i < itemCount; i++) {
				if (broke) break
				await test.step(`Add Products # ${i + 1}`, async () => {
					try {
						await expect(products.nth(i)).toBeVisible({ timeout: 5000 })
						var productCard = products.nth(i)
						var addToCartButton = productCard.locator('a.add_to_cart_button')
						await addToCartButton.click({ force: true })
						await this.page.waitForTimeout(1500)
					} catch (e) {
						console.log(`[INFO] Product #${i + 1} not visible — only ${i} product(s) added. Proceeding to cart to validate minimum.`)
						broke = true
					}
				})
			}
			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			await this.goToCart({ requireItems: true })
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
	async goToCart(options: GoToCartOptions = {}) {
		await test.step('Navigate to Cart', async () => {
			await this.page.goto(this.getCartPath())
			await this.waitForCartLoaded(options)
		})
	}

	async addProductsToCartPickup(
		itemCount: number,
		mobile = false,
		fulfillment = 'Pickup',
		usage: TestUsageType = 'recreational',
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

			if (!isMedicalUsage(usage)) {
				products = await products.filter({ hasNot: this.page.locator('span.medOnly') })
			}

			let broke = false
			for (let i = 0; i < itemCount; i++) {
				if (broke) break
				await test.step(`Add Products # ${i + 1}`, async () => {
					try {
						await expect(products.nth(i)).toBeVisible({ timeout: 5000 })
						var productCard = products.nth(i)
						var addToCartButton = productCard.locator('a.add_to_cart_button')
						await addToCartButton.click({ force: true })
						await this.page.waitForTimeout(1500)
					} catch (e) {
						console.log(`[INFO] Product #${i + 1} not visible — only ${i} product(s) added. Proceeding to cart to validate minimum.`)
						broke = true
					}
				})
			}

			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			await this.goToCart({ requireItems: true })
		})
	}
}
