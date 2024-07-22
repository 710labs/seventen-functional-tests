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
	constructor(page: Page, browserName: any, workerInfo: TestInfo) {
		this.page = page
		this.browserName = browserName
		this.workerInfo = workerInfo
		this.baseUrl = process.env.BASE_URL
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
			var addToCartButtons

			if (type === 'Recreational') {
				await this.page.waitForSelector(
					'//li[contains(@class, "product") and not(.//h2[contains(@class, "woocommerce-loop-product__title")]/span[contains(@class, "medOnly")])]//a[contains(@aria-label, "Add to cart:")]',
				)
				await this.page.waitForTimeout(5000)
				addToCartButtons = await this.page.locator(
					'//li[contains(@class, "product") and not(.//h2[contains(@class, "woocommerce-loop-product__title")]/span[contains(@class, "medOnly")])]//a[contains(@aria-label, "Add to cart:")]',
				)
			} else {
				await this.page.waitForSelector('[aria-label*="Add to cart:"]')
				await this.page.waitForTimeout(5000)
				addToCartButtons = await this.page.locator('[aria-label*="Add to cart:"]')
			}

			for (let i = 0; i < itemCount; i++) {
				await expect(addToCartButtons.nth(i)).toBeVisible()
				await addToCartButtons.nth(i).click({ force: true })
				await this.page.waitForSelector('text="has been added to your"');


				await this.page.waitForTimeout(1500)
			}
			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			if (this.workerInfo.project.name === 'Mobile Chrome') {
				await this.page.locator(`.footer-cart-contents`).first().click({ force: true })
			} else {
				if (
					process.env.BASE_URL === 'https://thelist.theflowery.co/' ||
					process.env.BASE_URL === 'https://thelist-co.710labs.com/'
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
			var addToCartButtons

			if (type === 'Recreational') {
				await this.page.waitForSelector(
					'//li[contains(@class, "product") and not(.//h2[contains(@class, "woocommerce-loop-product__title")]/span[contains(@class, "medOnly")])]//a[contains(@aria-label, "Add to cart:")]',
				)
				await this.page.waitForTimeout(5000)
				addToCartButtons = await this.page.locator(
					'//li[contains(@class, "product") and not(.//h2[contains(@class, "woocommerce-loop-product__title")]/span[contains(@class, "medOnly")])]//a[contains(@aria-label, "Add to cart:")]',
				)
			} else {
				await this.page.waitForSelector('[aria-label*="Add to cart:"]')
				await this.page.waitForTimeout(5000)
				addToCartButtons = await this.page.locator('[aria-label*="Add to cart:"]')
			}
			for (let i = 0; i < itemCount; i++) {
				await expect(
					addToCartButtons.nth(i),
					'Product Add to Cart Button should be Visible and Active',
				).toBeVisible()
				await addToCartButtons.nth(i).click({ force: true })
				await this.page.waitForSelector('text="has been added to your"');

				await this.page.waitForTimeout(1500)
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
