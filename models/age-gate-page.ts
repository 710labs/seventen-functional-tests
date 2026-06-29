import test, { expect, Page } from '@playwright/test'
import { addListBypassCookies } from '../support/qa/recaptcha-bypass'

export class AgeGatePage {
	page: Page
	/**
	 * @param {import('playwright').Page} page
	 */
	constructor(page) {
		this.page = page
	}

	private async getBodyPreview() {
		const bodyText = await this.page
			.locator('body')
			.innerText({ timeout: 1000 })
			.catch(() => '')

		return bodyText.replace(/\s+/g, ' ').trim().slice(0, 500)
	}

	private async assertNotForbidden(status?: number) {
		const bodyPreview = await this.getBodyPreview()

		if (status === 403 || /\b403 Forbidden\b/i.test(bodyPreview)) {
			throw new Error(
				[
					'The List returned 403 before the age gate loaded.',
					`Current URL: ${this.page.url()}`,
					`HTTP status: ${status ?? 'unknown'}`,
					`RECAPTCHA_BYPASS configured: ${process.env.RECAPTCHA_BYPASS ? 'yes' : 'no'}`,
					`Body preview: ${bodyPreview || 'empty'}`,
				].join('\n'),
			)
		}
	}

	private async findVisibleAgeGateButton() {
		const isMichigan = this.page.url().includes('thelist-mi')
		const ageGateButtons = isMichigan
			? [this.page.getByRole('button', { name: /^I qualify$/i })]
			: [
					this.page.getByRole('button', {
						name: "I'm over 21 or a qualified patient",
						exact: true,
					}),
				]

		for (const ageGateButton of ageGateButtons) {
			if (await ageGateButton.isVisible({ timeout: 1000 }).catch(() => false)) {
				return ageGateButton
			}
		}

		return null
	}

	async passAgeGate() {
		await test.step('Pass Age Gate', async () => {
			await addListBypassCookies(this.page.context(), process.env.BASE_URL)
			const response = await this.page.goto('/', { waitUntil: 'domcontentloaded' })
			await this.assertNotForbidden(response?.status())

			const passwordField = this.page.locator('input[name="post_password"]')
			const ageGateButton = await this.findVisibleAgeGateButton()

			if (ageGateButton) {
				if (this.page.url().includes('thelist.theflowery.co')) {
					await expect(this.page.locator('.age-gate-challenge')).toContainText(
						'You must be at least 18 years old with a valid Florida medical recommendation to view this site.',
					)
				} else if (
					this.page.url().includes('thelist-co') ||
					this.page.url().includes('thelist-mi')
				) {
					await expect(this.page.locator('.age-gate-challenge')).toContainText(
						'You must be at least 21 years old or possess a valid medical recommendation to view this site.',
					)
				} else if (
					this.page.url().includes('thelist-nj') ||
					this.page.url().includes('thelist-co.710labs.com')
				) {
					await expect(this.page.locator('.age-gate-challenge')).toContainText(
						'You must be at least 21 years old or possess a valid medical recommendation to view this site.',
					)
				}

				await ageGateButton.click()
				await expect(this.page.locator('.age-gate-wrapper')).toBeHidden()
			} else if (!(await passwordField.isVisible({ timeout: 1000 }).catch(() => false))) {
				throw new Error(
					[
						'Could not find an age gate confirmation button or password field.',
						`Current URL: ${this.page.url()}`,
						`Body preview: ${await this.getBodyPreview()}`,
					].join('\n'),
				)
			}

			await expect(
				passwordField,
				'Could not find the The List password field. The list password page may be in the incorrect order workflow',
			).toBeVisible()
			await passwordField.click()
		})
	}

	async failAgeGate() {
		await test.step('Fail Age Gate', async () => {
			await this.page.goto('/')
			await this.page.click("text=I'm not 21 yet or don't qualify")
			await expect(this.page.locator('.age-gate__error')).toHaveText(
				'You are not old enough to view this content',
			)
		})
	}
}
module.exports = { AgeGatePage }
