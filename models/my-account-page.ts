import test, { expect, Locator, Page } from '@playwright/test'

export class MyAccountPage {
	readonly page: Page
	readonly ordersLink: Locator
	readonly addressesLink: Locator
	readonly accountDetailsLink: Locator
	readonly cardsLink: Locator
	readonly logoutLink: Locator
	readonly addressLineOne: Locator
	readonly city: Locator
	readonly state: Locator
	readonly phone: Locator
	readonly editBillingAddressLink: Locator
	readonly editShippingAddressLink: Locator

	constructor(page: Page) {
		this.page = page
		this.ordersLink = page.locator('text=orders')
		this.addressesLink = page.locator('text=Address Book')
		this.accountDetailsLink = page.locator('a:has-text("Account details")')
		this.cardsLink = page.locator('.woocommerce-MyAccount-navigation-link--id-med-card')
		this.logoutLink = page.locator('text=Sign Out')
		this.addressLineOne = page.locator('#billing_address_1')
		this.city = page.locator('#billing_city')
		this.state = page.locator('#billing_state')
		this.phone = page.locator('#billing_phone')
		this.editBillingAddressLink = page.locator('text=Billing address Edit >> a')
		this.editShippingAddressLink = page.locator('text=Delivery address Edit >> a')
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

	async addAddress(
		address: string = '420 Dank Street',
		city: string = 'Beverly Hills',
		state: string = 'CA',
	) {
		await test.step('Update Customer Address', async () => {
			await this.page.goto('/my-account/')
			await this.addressesLink.click()
			await this.editBillingAddressLink.click()
			await this.addressLineOne.fill(address)
			await this.city.fill(city)
			await this.page.click('button:has-text("Save address")')
		})
	}
}
