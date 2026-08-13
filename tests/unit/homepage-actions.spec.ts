import { expect, test } from '@playwright/test'
import { HomePageActions } from '../../models/always-on/homepage-actions.ts'

test.describe('homepage address submission', () => {
	test('submits when the drawer button remains outside the viewport', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 720 })
		await page.setContent(`
			<button
				class="wpse-button-primary fasd-form-submit"
				style="position: fixed; top: 900px;"
				type="button"
			>
				Submit
			</button>
			<script>
				document.querySelector('button').addEventListener('click', () => {
					document.body.dataset.addressSubmitted = 'true'
				})
			</script>
		`)

		const homePageActions = new HomePageActions(page)
		await homePageActions.submitAddress(page)

		await expect(page.locator('body')).toHaveAttribute('data-address-submitted', 'true')
	})
})
