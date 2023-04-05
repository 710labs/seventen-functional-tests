import test, { expect, Locator, Page } from '@playwright/test'

export class EditProfilePage {
	readonly page: Page

	constructor(page: Page) {
		this.page = page
	}

	async addComp(discountAmount: number, email: string): Promise<void> {
		await test.step('Go to cusomers screen', async () => {
			await this.page.getByRole('link', { name: 'WooCommerce' }).click()
			await this.page.getByRole('link', { name: 'Customers', exact: true }).click()
			await this.page.getByRole('button', { name: 'All Customers' }).click()
			await this.page.getByRole('button', { name: 'Advanced filters' }).click()
			await this.page.getByRole('button', { name: 'Add a Filter' }).click()
			await this.page.getByRole('button', { name: 'Email' }).click()
			await this.page.getByPlaceholder('Search customer email').fill(email)
			await this.page.getByRole('option', { name: email }).click()
			await this.page.locator(`[data-link-type="wp-admin"]`).click()
		})
		await test.step('Add Comp', async () => {
			var compValue = this.page.locator('#compBalance')
            
			await this.page.getByRole('heading', { name: 'Account Comps' }).getByRole('button').click()
			await this.page.getByLabel('Amount').fill(`${discountAmount}`)
			await this.page.getByLabel('Description').fill('testing-auto-discounts')
			await this.page.getByRole('button', { name: 'Add comp' }).click()

			await expect(compValue.innerText()).toContain(`${discountAmount}`)
		})
	}

	async removeComp(orderNumber: any) {
		await test.step('Pull Edit Order Page', async () => {
			await this.page.goto(`/wp-admin/post.php?post=${orderNumber}&action=edit`)
		})
		await test.step('Cancel Order', async () => {
			await this.page.locator('#select2-order_status-container').click()
			await this.page.locator('li[role="option"]:has-text("Cancelled")').click()
			await this.page.locator('button[name="save"]').click()
			//console.log('Cancelled Order:' + (await this.page.url()))
		})
	}
}
