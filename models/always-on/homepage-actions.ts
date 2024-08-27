require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class HomePageActions {
	readonly page: Page
	readonly pageTitleSelector: Locator
	readonly accountButtonNav: Locator
	readonly cartButtonNav: Locator
	readonly addToCartButtonGeneral: Locator
	readonly enterAddressButtonDesktop: Locator
	readonly enterAddressButtonMobile: Locator
	readonly addressInfoSideBarContainer: Locator
	readonly addressField: Locator
	readonly submitAddressButton: Locator

	constructor(page: Page) {
		this.page = page
		this.pageTitleSelector = page.locator('span.site-header-group')
		this.accountButtonNav = page.locator('svg.icon.icon-account')
		this.cartButtonNav = page.locator('svg.icon.icon-pickup')
		this.addToCartButtonGeneral = page.locator('button[aria-label="Add product to cart"]')
		this.enterAddressButtonDesktop = page.locator('#wide_flflmnt')
		this.enterAddressButtonMobile = page.locator('#slim_flflmnt')
		this.addressInfoSideBarContainer = page.locator('div.wpse-drawer[data-module="fulfillment"]')
		this.addressField = page.locator('#fasd_address')
		this.submitAddressButton = page.locator('button.wpse-button-primary.fasd-form-submit')
	}
	async enterAddress(page) {
		await test.step('Click address button', async () => {
			const viewportSize = await page.viewportSize()
			if (viewportSize.width <= 768) {
				// Mobile view
				await this.enterAddressButtonMobile.waitFor({ state: 'visible' })
				await expect(this.enterAddressButtonMobile).toBeVisible()
				await this.enterAddressButtonMobile.click()
			} else {
				// Desktop view
				await this.enterAddressButtonDesktop.waitFor({ state: 'visible' })
				await expect(this.enterAddressButtonDesktop).toBeVisible()
				await this.enterAddressButtonDesktop.click()
			}
		})
		await test.step('Enter address info into field', async () => {
			//verify address sidebar container AND address field are visible
			await this.addressInfoSideBarContainer.waitFor({ state: 'visible' })
			await expect(this.addressInfoSideBarContainer).toBeVisible()
			await expect(this.addressField).toBeVisible()

			const address = '440 Rodeo Drive Beverly Hills'

			// Type the address into the text field
			await this.addressField.fill(address)

			// Wait for the autocomplete suggestions to appear
			await this.page.waitForSelector('.pac-item') // Replace with the actual class or selector of the autocomplete suggestion items

			// Press 'ArrowDown' to navigate to the first suggestion and then press 'Enter' to select it
			await this.addressField.press('ArrowDown')
			await this.addressField.press('Enter')
		})
		await test.step('Click submit button', async () => {
			await this.page.waitForTimeout(1500)
			await expect(this.submitAddressButton).toBeVisible()
			await this.submitAddressButton.click()
			// verify that address sidebar dissappears after submitting address
			await expect(this.addressField).toBeHidden()
			//await this.addressInfoSideBarContainer.waitFor({ state: 'hidden' })
		})
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
module.exports = { HomePageActions }
