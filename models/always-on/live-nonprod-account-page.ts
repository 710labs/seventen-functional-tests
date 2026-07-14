import { Page } from '@playwright/test'
import { AccountPage } from './account-page'

export class LiveNonProdAccountPage extends AccountPage {
	constructor(page: Page) {
		super(page)
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
