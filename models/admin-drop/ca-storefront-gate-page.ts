import test, { Locator, Page } from '@playwright/test'

export class CAStorefrontGatePage {
	readonly page: Page
	readonly ageGateChallenge: Locator
	readonly passButton: Locator

	constructor(page: Page) {
		this.page = page
		this.ageGateChallenge = page.locator('.age-gate-challenge')
		this.passButton = page.getByText("I'm over 21 or a qualified patient", { exact: true })
	}

	async openHomeAndPassAgeGateIfPresent() {
		await test.step('Open storefront and pass CA age gate if present', async () => {
			await this.page.goto('/')

			const isAgeGateVisible = await this.ageGateChallenge
				.first()
				.isVisible({ timeout: 5000 })
				.catch(() => false)

			if (!isAgeGateVisible) {
				return
			}

			await this.passButton.click()
			await this.ageGateChallenge.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
		})
	}
}
