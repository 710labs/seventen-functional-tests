import { Page } from '@playwright/test'
import { HomePageActions } from './homepage-actions.ts'

const liveAuthenticationAddress = '440 Rodeo Drive Beverly Hills'
const liveProductSelector = 'li.product.type-product'

export class LiveNonProdHomePageActions extends HomePageActions {
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
