import test, { Locator, Page } from '@playwright/test'
import { assertFooterLinks } from '../utils/footer-links'

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
		await test.step('Validate Scheduling Page', async () => {
			await assertFooterLinks(this.page)
		})
		await test.step('Schedule Delivery Slot', async () => {
			await this.deliveryDay.evaluate((node: HTMLElement) => {
				node.click()
			})
			await this.page.waitForTimeout(10000) 
			await this.deliveryTime.evaluate((node: HTMLElement) => {
				node.click()
			})
			await this.submitDeliveryButton.evaluate((node: HTMLElement) => {
				node.click()
			})
		})
	}
}
