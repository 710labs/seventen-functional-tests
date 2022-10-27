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

	async addProductsToCart(itemCount: number, mobile = false) {
		await test.step('Navigate to Shop page', async () => {
			await this.page.goto('/')
			await this.page.waitForTimeout(3000)
		})
		await test.step('Select Fulfillment Method', async () => {
			if (process.env.NEXT_VERSION === 'true') {
				await this.page.waitForSelector('label:has-text("Delivery")')
				await this.page.locator('label:has-text("Delivery") >> nth=0').click()
				await this.page.locator('#fulfillerSubmit').click()
				await this.page.waitForTimeout(2000)
				await this.page.reload()
			}
		})
		await test.step('Add Products to Cart', async () => {
			itemCount = itemCount + (await this.randomizeCartItems())
			await this.page.waitForSelector('[aria-label*="to your cart"]')
			await this.page.waitForTimeout(5000)
			const addToCartButtons = await this.page
				.locator('[aria-label*="to your cart"]')
				.elementHandles()

			for (let i = 0; i < itemCount; i++) {
				await addToCartButtons[i].click({ force: true })
				await this.page.waitForTimeout(1500)
			}
			await this.page.keyboard.press('PageUp')
			await this.page.waitForTimeout(2000)
			if (mobile) {
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
	async addSameProductToCart(itemCount: number) {
		await test.step('Add Products to Cart', async () => {
			await this.page.waitForSelector('[aria-label*="to your cart"]')

			const addToCartButtons = await this.page
				.locator('[aria-label*="to your cart"]')
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
}
