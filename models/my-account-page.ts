import test, { expect, Locator, Page } from '@playwright/test'

export class MyAccountPage {
	readonly page: Page
	readonly ordersLink: Locator
	readonly addressesLink: Locator
	readonly accountDetailsLink: Locator
	readonly cardsLink: Locator
	readonly logoutLink: Locator

	constructor(page: Page) {
		this.page = page
		this.ordersLink = page.locator('text=orders')
		this.addressesLink = page.locator('text=Addresses')
		this.accountDetailsLink = page.locator('a:has-text("Account details")')
		this.cardsLink = page.locator('.woocommerce-MyAccount-navigation-link--id-med-card')
		this.logoutLink = page.locator('text=Sign Out')
	}

	async logout() {
		await test.step('Verify Layout', async () => {
			await expect(this.page.locator('.site-info > span > a')).toHaveAttribute(
				'href',
				'/terms-of-use',
			)
			await expect(this.page.locator('.site-info > a')).toHaveAttribute('href', '/privacy-policy')
		})
		await test.step('Logout User', async () => {
			await this.page.goto('/my-account/')
			await this.logoutLink.click()
			await expect(this.page.locator('h2:has-text("Sign In")')).toBeVisible()
		})
	}
}
