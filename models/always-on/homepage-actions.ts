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
	readonly cartDrawerContainer: Locator
	readonly closeCartDrawerButton: Locator

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
		this.cartDrawerContainer = page.locator('#cartDrawer')
		this.closeCartDrawerButton = page.locator(
			'button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer',
		)
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
	async addProductsToCart(page, numberOfItems) {
		// Get all the products on the page
		const products = await page.locator('ul.products li.product')

		// Loop through the specified number of items
		for (let i = 0; i < numberOfItems; i++) {
			// Check if there are enough products to add
			if (i >= (await products.count())) {
				console.log(`Only ${await products.count()} products available on the page.`)
				break
			}

			// Get the 'Add to Cart' button and product name for the current product
			const product = products.nth(i)
			const addToCartButton = product.locator('button.add_to_cart_button')
			const productName = await product.locator('.woocommerce-loop-product__title').innerText()

			// Click the 'Add to Cart' button
			await addToCartButton.click()
			await page.waitForTimeout(4000) // Adjust this timeout based on your app's behavior

			// Wait for the cartDrawer to become visible
			await page.waitForSelector('#cartDrawer', { state: 'visible' })

			// Verify that the product was added to the cart by checking the cartDrawer
			const cartItem = await page.locator(
				`#cartDrawer .woocommerce-cart-form__cart-item .product-name a:has-text("${productName}")`,
			)
			const isProductInCart = (await cartItem.count()) > 0

			if (!isProductInCart) {
				throw new Error(`Product "${productName}" was not found in the cart after being added.`)
			}

			console.log(`Product "${productName}" was successfully added to the cart.`)

			// Close the cartDrawer
			await this.closeCartDrawerButton.click()

			// Wait for the cartDrawer to be hidden again
			//await page.waitForSelector('#cartDrawer', { state: 'hidden' })

			// Optionally, wait before adding the next product to account for any animations or delays
			await page.waitForTimeout(1000) // Adjust this timeout based on your app's behavior
		}
	}
}
module.exports = { HomePageActions }
