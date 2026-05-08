import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '../../options'
import { AgeGatePage } from '../../models/age-gate-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { CartPage } from '../../models/cart-page'
import { CheckoutPage } from '../../models/checkout-page'
import {
	SvntnCoreSettingsPage,
	type MinimumOrderSettings,
} from '../../models/admin/svntn-core-settings-page'
import { ShopPage } from '../../models/shop-page'

function randomMinimumExcludingCurrent(originalSettings?: MinimumOrderSettings) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const minimum = Math.floor(Math.random() * 151) + 150

		if (
			!originalSettings ||
			(minimum !== originalSettings.pickupMinimum && minimum !== originalSettings.deliveryMinimum)
		) {
			return minimum
		}
	}

	return Math.floor(Math.random() * 151) + 150
}

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
	await testInfo.attach(name, {
		body: JSON.stringify(body, null, 2),
		contentType: 'application/json',
	})
}

async function assertPublishedProductsExist(page: Page, testInfo: TestInfo) {
	await test.step('Verify uploaded menu exists in admin', async () => {
		await page.goto('/wp-admin/edit.php?post_status=publish&post_type=product&paged=1')
		await expect(page).toHaveURL(/post_type=product/)

		const productRows = page.locator('#the-list tr[id^="post-"]')
		const productCount = await productRows.count()
		const emptyStateVisible = await page
			.locator('#the-list .no-items')
			.first()
			.isVisible()
			.catch(() => false)

		await attachJson(testInfo, 'minimum-order-admin-product-preflight', {
			productCount,
			emptyStateVisible,
			url: page.url(),
		})

		if (productCount === 0 || emptyStateVisible) {
			throw new Error(
				[
					'Minimum-order smoke requires a previously uploaded menu before admin minimums are changed.',
					'Run the menu-upload smoke first, then run @minorder.',
					`Published product rows found: ${productCount}`,
					`Empty state visible: ${emptyStateVisible}`,
					`Current URL: ${page.url()}`,
				].join('\n'),
			)
		}
	})
}

async function passStorefrontGates(page: Page, shopPage: ShopPage) {
	await test.step('Pass storefront gates', async () => {
		expect(process.env.CHECKOUT_PASSWORD, 'CHECKOUT_PASSWORD is required for storefront unlock').toBeTruthy()

		const ageGatePage = new AgeGatePage(page)
		const listPasswordPage = new ListPasswordPage(page)

		await ageGatePage.passAgeGate()
		await listPasswordPage.submitPassword(process.env.CHECKOUT_PASSWORD || '')
		await expect(
			page.locator('input[name="post_password"]').first(),
			'Expected private-store password gate to close after submitting CHECKOUT_PASSWORD',
		).toBeHidden({ timeout: 10000 })
		await shopPage.openStorefrontForFulfillment('Delivery')
	})
}

test('Focused rules minimum order is enforced @admin-drop @rules @minorder', async ({
	page,
	browserName,
	qaClient,
}, testInfo) => {
	const settingsPage = new SvntnCoreSettingsPage(page)
	let originalSettings: MinimumOrderSettings | undefined
	let generatedSettings: MinimumOrderSettings | undefined
	let persistedSettings: MinimumOrderSettings | undefined
	let restoredSettings: MinimumOrderSettings | undefined

	await assertPublishedProductsExist(page, testInfo)
	await settingsPage.goto()
	originalSettings = await settingsPage.getMinimumOrderSettings()
	const generatedMinimum = randomMinimumExcludingCurrent(originalSettings)
	generatedSettings = {
		pickupMinimum: generatedMinimum,
		deliveryMinimum: generatedMinimum,
	}

	await attachJson(testInfo, 'minimum-order-generated-settings', {
		generatedMinimum,
		originalSettings,
		generatedSettings,
	})

	await settingsPage.setAndSaveMinimumOrderSettings(generatedSettings)
	persistedSettings = await settingsPage.assertMinimumOrderSettings(generatedSettings)
	await attachJson(testInfo, 'minimum-order-persisted-settings', persistedSettings)

	const shopPage = new ShopPage(page, browserName, testInfo)
	const cartPage = new CartPage(page, qaClient, browserName, testInfo, 'recreational')
	const checkoutPage = new CheckoutPage(page, qaClient)

	await test.step('Run storefront delivery checkout flow', async () => {
		await passStorefrontGates(page, shopPage)
		const minimumOrderSummary = await shopPage.addProductsUntilMinimumMet(
			generatedMinimum,
			'Delivery',
			'recreational',
		)
		await attachJson(testInfo, 'minimum-order-cart-build-summary', minimumOrderSummary)
		const cartTotals = await cartPage.verifyCart('94020')
		await checkoutPage.confirmCheckout('94020', cartTotals, 'recreational')
	})

	await settingsPage.goto()
	await settingsPage.setAndSaveMinimumOrderSettings(originalSettings)
	restoredSettings = await settingsPage.assertMinimumOrderSettings(originalSettings)
	await attachJson(testInfo, 'minimum-order-restored-settings', {
		originalSettings,
		restoredSettings,
	})

	await attachJson(testInfo, 'minimum-order-admin-settings-summary', {
		generatedSettings,
		originalSettings,
		persistedSettings,
		restoredSettings,
	})
})
