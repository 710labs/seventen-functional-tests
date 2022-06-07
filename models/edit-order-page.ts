import test, { expect, Locator, Page } from '@playwright/test'

export class EditOrderPage {
	readonly page: Page
	readonly userNameField: Locator
	readonly passwordField: Locator
	readonly loginButton: Locator

	constructor(page: Page) {
		this.page = page
		this.userNameField = page.locator('input[name="log"]')
		this.passwordField = page.locator('input[name="pwd"]')
		this.loginButton = page.locator('text=Log In')
	}

	async splitOrder(orderNumber: any, orderQuanity: any): Promise<string> {
		var splitOrderNumber
		await test.step('Pull Edit Order Page', async () => {
			await this.page.goto(`/wp-admin/post.php?post=${orderNumber}&action=edit`)
			console.log('Order Link:' + (await this.page.url()))
		})
		await test.step('Split half of order', async () => {
			await this.page.locator('text=Split order').click()
			await this.page.waitForSelector('.item')
			await this.page.waitForTimeout(500)
			await (await this.page.$('.qty-split')).click()
			await (await this.page.$('.qty-split')).fill('1')
			await this.page.locator('text=Complete split').click()
		})
		await test.step('Confirm Split', async () => {
			await this.page.waitForSelector('text=Order split into')
			splitOrderNumber = await (
				await (await this.page.$('text=Order split into >> a')).innerText()
			).replace('#', '')
			await this.page.goto(`/wp-admin/post.php?post=${splitOrderNumber}&action=edit`)
			await this.page.waitForURL(`/wp-admin/post.php?post=${splitOrderNumber}&action=edit`)
			await expect(
				await this.page.locator(`text=Order split from #${orderNumber}`),
				'split should link to original order',
			).toBeVisible()
		})
		console.log('Split Order Link:' + (await this.page.url()))
		return splitOrderNumber
	}

	async cancelOrder(orderNumber: any) {
		await test.step('Pull Edit Order Page', async () => {
			await this.page.goto(`/wp-admin/post.php?post=${orderNumber}&action=edit`)
		})
		await test.step('Cancel Order', async () => {
			await this.page.locator('#select2-order_status-container').click()
			await this.page.locator('li[role="option"]:has-text("Cancelled")').click()
			await this.page.locator('button[name="save"]').click()
			console.log('Cancelled Order:' + (await this.page.url()))
		})
	}
}
