import { expect, Page } from '@playwright/test'
import { HomePageActions } from './homepage-actions.ts'

const liveAuthenticationAddress = '440 Rodeo Drive Beverly Hills'
const liveProductSelector = 'li.product.type-product'

export class LiveNonProdHomePageActions extends HomePageActions {
	override async enterAddress(page: Page, storeType: string, addressParam: string) {
		await this.openAddressSection(page, storeType)
		await this.addressInfoSideBarContainer.waitFor({ state: 'visible' })

		if (!(await this.addressField.isVisible().catch(() => false))) {
			const addNewAddress = this.addressInfoSideBarContainer
				.locator('label:has-text("Add new address")')
				.first()

			await expect(addNewAddress).toBeVisible()
			await addNewAddress.evaluate((element: HTMLElement) => element.click())
			await this.addressField.waitFor({ state: 'visible', timeout: 5000 })
		}

		await expect(this.addressField).toBeVisible()
		await this.addressField.fill(addressParam)
		await page.locator('.pac-item').first().waitFor({ state: 'visible', timeout: 10000 })
		await this.addressField.press('ArrowDown')
		await this.addressField.press('Enter')
		await this.submitAddress(page)
	}

	override async addSingleProductToCart(page: Page) {
		const firstProduct = page.locator(liveProductSelector).first()
		let productsAreVisible = await firstProduct.isVisible().catch(() => false)

		if (!productsAreVisible) {
			productsAreVisible = await firstProduct
				.waitFor({ state: 'visible', timeout: 5000 })
				.then(() => true)
				.catch(() => false)
		}

		if (!productsAreVisible) {
			await this.enterAddress(page, 'live', liveAuthenticationAddress)
			await firstProduct.waitFor({ state: 'visible', timeout: 15000 })
		}

		await super.addSingleProductToCart(page)
	}
}
