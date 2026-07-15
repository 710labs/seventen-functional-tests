import { Page } from '@playwright/test'
import { AccountPage } from './account-page'

export class LiveNonProdAccountPage extends AccountPage {
	constructor(page: Page) {
		super(page)
	}

	private async dismissBlockingStorefrontOverlay() {
		await this.page.waitForLoadState('domcontentloaded').catch(() => {})
		await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

		const cartDrawer = this.page.locator('#cartDrawer')

		if (await cartDrawer.isVisible().catch(() => false)) {
			const cartDrawerContainer = this.page.locator('.wpse-drawer[data-module="cart"]')
			const drawerCloseButton = cartDrawerContainer
				.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
				.first()

			if ((await drawerCloseButton.count()) > 0) {
				await drawerCloseButton.evaluate((element: HTMLElement) => element.click())
				await cartDrawer.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
			}

			if (await cartDrawer.isVisible().catch(() => false)) {
				const cartToggle = this.page.locator('a.wpse-cart-openerize').first()

				if ((await cartToggle.count()) > 0) {
					await cartToggle.evaluate((element: HTMLElement) => element.click())
					await cartDrawer.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
				}
			}

			if (await cartDrawer.isVisible().catch(() => false)) {
				throw new Error(
					`Unable to close the Live non-production cart drawer before account navigation. Current URL: ${this.page.url()}`,
				)
			}
		}

		const visibleScrim = this.page.locator('.wpse-scrim-front:visible').first()

		if ((await visibleScrim.count()) > 0) {
			await visibleScrim.evaluate((element: HTMLElement) => element.click())
			await this.page.waitForTimeout(500)
		}

		if ((await this.page.locator('.wpse-scrim-front:visible').count()) > 0) {
			await this.page.keyboard.press('Escape')
			await this.page.waitForTimeout(500)
		}

		if ((await this.page.locator('.wpse-scrim-front:visible').count()) > 0) {
			throw new Error(
				`A storefront scrim is still blocking Live non-production account navigation. Current URL: ${this.page.url()}`,
			)
		}
	}

	async goToAccountPage() {
		await this.dismissBlockingStorefrontOverlay()
		await super.goToAccountPage()
	}

	async editPersonalInfo(userType: string) {
		for (let attempt = 1; attempt <= 3; attempt += 1) {
			try {
				return await super.editPersonalInfo(userType)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				const isDetachedElement = /not attached to the DOM|element is detached/i.test(message)
				const drawerWasOpened = await this.personalInfoDrawerHeader.isVisible().catch(() => false)

				if (!isDetachedElement || drawerWasOpened || attempt === 3) {
					throw error
				}

				await this.page.waitForTimeout(500)
			}
		}

		throw new Error('Unable to open Live personal information after three attempts.')
	}
}
