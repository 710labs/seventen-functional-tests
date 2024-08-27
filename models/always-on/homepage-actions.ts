require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class HomePageCartActions {
	readonly page: Page
	readonly pageTitleSelector: Locator
	readonly accountButtonNav: Locator
	readonly cartButtonNav: Locator
	readonly addToCartButtonGeneral: Locator

	constructor(page: Page) {
		this.page = page
		this.pageTitleSelector = page.locator('span.site-header-group')
		this.accountButtonNav = page.locator('svg.icon.icon-account')
		this.cartButtonNav = page.locator('svg.icon.icon-pickup')
		this.addToCartButtonGeneral = page.locator('button[aria-label="Add product to cart"]')
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
		//add products to Cart
		itemCount = itemCount + (await this.randomizeCartItems())
		var products
		await this.page.waitForSelector('button[aria-label="Add product to cart"]')
		products = await this.page.locator('li.product').filter({ hasNotText: 'Sold Out' })

		if (type === 'Recreational') {
			products = products.filter({ hasNot: this.page.locator('span.medOnly') })
		}

		for (let i = 0; i < itemCount; i++) {
			await test.step(`Add Products # ${i + 1}`, async () => {
				await expect(products.nth(i)).toBeVisible()
				var productCard = products.nth(i)
				var addToCartButton = productCard.locator('button[aria-label="Add product to cart"]')
				await addToCartButton.click({ force: true })
				await this.page.waitForTimeout(1500)
			})
		}
		await this.page.keyboard.press('PageUp')
	}
}
module.exports = { HomePageCartActions }
