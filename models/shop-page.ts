import test, { Browser, expect, Locator, Page, TestInfo } from '@playwright/test'

export class ShopPage {
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
	}

	async randomizeCartItems() {
		return Math.random() * (2 - -2 + -2)
	}

	async addProductsToCart(itemCount: number) {
		await test.step('Add Products to Cart', async () => {
			itemCount = itemCount + (await this.randomizeCartItems())
			await this.page.goto('/')
			await this.page.waitForTimeout(3000)
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
			await this.page
				.locator(`[title="View your shopping cart"] >> visible=true`)
				.click({ force: true })
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
			await this.page.locator(`[title="View your shopping cart"] >> visible=true`).click()
		})
	}
}
