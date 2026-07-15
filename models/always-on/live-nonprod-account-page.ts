import { Page } from '@playwright/test'
import { AccountPage } from './account-page'

export class LiveNonProdAccountPage extends AccountPage {
	constructor(page: Page) {
		super(page)
	}

	private async elementIntersectsViewport(locator: ReturnType<Page['locator']>) {
		if ((await locator.count()) === 0) {
			return false
		}

		return locator
			.evaluate(element => {
				const rect = element.getBoundingClientRect()
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					rect.left < window.innerWidth &&
					rect.right > 0 &&
					rect.top < window.innerHeight &&
					rect.bottom > 0
				)
			})
			.catch(() => false)
	}

	private async cartDrawerIsOpen() {
		return this.elementIntersectsViewport(
			this.page.locator('.wpse-drawer[data-module="cart"]'),
		)
	}

	private async waitForCartDrawerState(isOpen: boolean, timeout = 5000) {
		const deadline = Date.now() + timeout

		while (Date.now() < deadline) {
			if ((await this.cartDrawerIsOpen()) === isOpen) {
				return true
			}

			await this.page.waitForTimeout(100)
		}

		return (await this.cartDrawerIsOpen()) === isOpen
	}

	private async clickActiveCartToggle() {
		const cartToggles = this.page.locator('a.wpse-cart-openerize')
		const cartToggleCount = await cartToggles.count()

		for (let index = 0; index < cartToggleCount; index += 1) {
			const cartToggle = cartToggles.nth(index)

			if (await this.elementIntersectsViewport(cartToggle)) {
				await cartToggle.evaluate((element: HTMLElement) => element.click())
				return true
			}
		}

		return false
	}

	private async getBlockingScrim() {
		const scrims = this.page.locator('.wpse-scrim-front')
		const scrimCount = await scrims.count()

		for (let index = 0; index < scrimCount; index += 1) {
			const scrim = scrims.nth(index)

			if (await this.elementIntersectsViewport(scrim)) {
				return scrim
			}
		}

		return null
	}

	private async dismissBlockingStorefrontOverlay() {
		await this.page.waitForLoadState('domcontentloaded').catch(() => {})
		await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

		if (await this.cartDrawerIsOpen()) {
			const cartDrawerContainer = this.page.locator('.wpse-drawer[data-module="cart"]')
			const drawerCloseButton = cartDrawerContainer
				.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
				.first()

			if ((await drawerCloseButton.count()) > 0) {
				await drawerCloseButton.evaluate((element: HTMLElement) => element.click())
				await this.waitForCartDrawerState(false)
			}

			if ((await this.cartDrawerIsOpen()) && (await this.clickActiveCartToggle())) {
				await this.waitForCartDrawerState(false)
			}

			if (await this.cartDrawerIsOpen()) {
				throw new Error(
					`Unable to close the Live non-production cart drawer before account navigation. Current URL: ${this.page.url()}`,
				)
			}
		}

		const visibleScrim = await this.getBlockingScrim()

		if (visibleScrim) {
			await visibleScrim.evaluate((element: HTMLElement) => element.click())
			await this.page.waitForTimeout(500)
		}

		if (await this.getBlockingScrim()) {
			await this.page.keyboard.press('Escape')
			await this.page.waitForTimeout(500)
		}

		if (await this.getBlockingScrim()) {
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
