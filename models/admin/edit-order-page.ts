import test, { expect, Page } from '@playwright/test'

export class EditOrderPage {
	readonly page: Page

	constructor(page: Page) {
		this.page = page
	}

	async splitOrder(orderNumber: string | number, _orderQuanity?: unknown): Promise<string> {
		let splitOrderNumber = ''
		await test.step('Pull Edit Order Page', async () => {
			await this.page.goto(`/wp-admin/post.php?post=${orderNumber}&action=edit`)
			//console.log('Order Link:' + (await this.page.url()))
		})
		await test.step('Split half of order', async () => {
			const splitOrderButton = this.page.locator('text=Split order').first()
			const splitQuantityInput = this.page.locator('.qty-split').first()
			const completeSplitButton = this.page.locator('text=Complete split').first()

			await expect(splitOrderButton, 'Expected Split order action to be visible').toBeVisible()
			await splitOrderButton.click()
			await expect(this.page.locator('.item').first(), 'Expected split order items to load').toBeVisible()
			await expect(splitQuantityInput, 'Expected split quantity input to be visible').toBeVisible()
			await splitQuantityInput.fill('1')
			await expect(completeSplitButton, 'Expected Complete split action to be visible').toBeVisible()
			await completeSplitButton.click()
		})
		await test.step('Confirm Split', async () => {
			const splitOrderLink = this.page.locator('text=Order split into >> a').first()

			await expect(splitOrderLink, 'Expected split success notice to link to child order').toBeVisible()
			splitOrderNumber = (await splitOrderLink.innerText()).replace('#', '').trim()
			expect(splitOrderNumber, 'Expected split child order number to be present').toBeTruthy()
			await this.page.goto(`/wp-admin/post.php?post=${splitOrderNumber}&action=edit`)
			await this.page.waitForURL(`/wp-admin/post.php?post=${splitOrderNumber}&action=edit`)
			await expect(
				this.page.locator(`text=Order split from #${orderNumber}`),
				'split should link to original order',
			).toBeVisible()
		})
		//.log('Split Order Link:' + (await this.page.url()))
		return splitOrderNumber
	}

	async cancelOrder(orderNumber: string | number) {
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
