import test, { expect, Locator, Page } from '@playwright/test'

export class SchedulingPage {
	readonly page: Page
	readonly deliveryDay: Locator
	readonly deliveryTime: Locator
	readonly submitDeliveryButton: Locator

	constructor(page: Page) {
		this.page = page
		this.deliveryDay = this.page.locator('input[name="svntnAcuityDate"]').first()
		this.deliveryTime = this.page.locator('input[name="svntnAcuityTime"]').first()
		this.submitDeliveryButton = this.page.locator('#svntnAcuitySubmit')
	}

	async scheduleDelivery(): Promise<any> {
		this.page.waitForNavigation()
		await test.step('Validate Scheduling Page', async () => {
			await expect(
				this.page.locator('#svntnAcuityPane'),
				'Accuity Scheduling should appear',
			).toBeVisible()
			await expect(this.page.locator('.site-info > span > a')).toHaveAttribute(
				'href',
				'/terms-of-use',
			)
			await expect(this.page.locator('.site-info > a')).toHaveAttribute('href', '/privacy-policy')
		})
		await test.step('Schedule Delivery Slot', async () => {
			await this.deliveryDay.evaluate((node: HTMLElement) => {
				node.click()
			})
			await this.deliveryTime.evaluate((node: HTMLElement) => {
				node.click()
			})
			await this.submitDeliveryButton.evaluate((node: HTMLElement) => {
				node.click()
			})
		})
	}
}
