import { expect, Page, test } from '@playwright/test'
import { assertFooterLinks } from '../../utils/footer-links'

async function loadFooterFixture(page: Page, footerHtml: string) {
	await page.route('http://footer.test/**', async route => {
		await route.fulfill({
			body: footerHtml,
			contentType: 'text/html',
		})
	})

	await page.goto('http://footer.test/checkout/')
}

test.describe('Footer Link Assertions', { tag: ['@CA', '@CO', '@FL', '@MI', '@NJ'] }, () => {
	test('accepts relative footer links without trailing slashes', async ({ page }) => {
		await loadFooterFixture(
			page,
			`
				<div class="site-info">
					<span><a href="/terms-of-use">Terms of Service</a></span>
					<a href="/privacy-policy">Privacy Policy</a>
				</div>
			`,
		)

		await assertFooterLinks(page)
	})

	test('accepts absolute footer links with trailing slashes', async ({ page }) => {
		await loadFooterFixture(
			page,
			`
				<div class="site-info">
					<span><a href="http://footer.test/terms-of-use/">Terms of Service</a></span>
					<a href="http://footer.test/privacy-policy/">Privacy Policy</a>
				</div>
			`,
		)

		await assertFooterLinks(page)
	})

	test('rejects unexpected footer paths', async ({ page }) => {
		await loadFooterFixture(
			page,
			`
				<div class="site-info">
					<span><a href="/terms">Terms of Service</a></span>
					<a href="/privacy-policy">Privacy Policy</a>
				</div>
			`,
		)

		let failure: unknown

		try {
			await assertFooterLinks(page)
		} catch (error) {
			failure = error
		}

		expect(failure, 'Expected footer assertion to reject the wrong path.').toBeTruthy()
		expect(String(failure)).toContain('/terms-of-use/')
	})

	test('rejects absolute footer links on a different origin', async ({ page }) => {
		await loadFooterFixture(
			page,
			`
				<div class="site-info">
					<span><a href="https://other-store.test/terms-of-use/">Terms of Service</a></span>
					<a href="http://footer.test/privacy-policy/">Privacy Policy</a>
				</div>
			`,
		)

		let failure: unknown

		try {
			await assertFooterLinks(page)
		} catch (error) {
			failure = error
		}

		expect(failure, 'Expected footer assertion to reject a different origin.').toBeTruthy()
		expect(String(failure)).toContain('origin')
	})
})
