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
	readonly zipCode: Locator
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
		this.zipCode = page.locator('#billing_postcode')
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
		zipCode: string = '90212',
	) {
		await test.step('Update Customer Address', async () => {
			await this.page.goto('/my-account/')
			await this.addressesLink.click()
			await this.editBillingAddressLink.click()
			await this.addressLineOne.fill(address)
			await this.city.fill(city)
			await this.zipCode.fill(zipCode)

			if (state == 'NJ') {
				await this.page.getByLabel('State *').selectOption(state)
			}
			await this.page.click('button:has-text("Save address")')
		})
	}

	async addMedicalExp() {
		await test.step('Update Med Card Expiration', async () => {
			const expYear = new Date().getFullYear() + 1
			await this.page.goto('/my-account/eligibility')
			await this.page.locator('#svntn_core_mxp_month').selectOption('01')
			await this.page.locator('#svntn_core_mxp_day').selectOption('16')
			await this.page.locator('#svntn_core_mxp_year').selectOption(`${expYear}`)
			await this.page.waitForTimeout(3000)
		})
	}

	async addColoradoAddress(
		address: string = '933 Alpine Ave',
		city: string = 'Boulder',
		state: string = 'CO',
		zipCode: string = '80304',
	) {
		await test.step('Update Customer Address', async () => {
			await this.page.goto('/my-account/')
			await this.addressesLink.click()
			await this.editBillingAddressLink.click()
			await this.addressLineOne.fill(address)
			await this.city.fill(city)
			await this.zipCode.fill(zipCode)
			await this.page.click('button:has-text("Save address")')
		})
	}
}
