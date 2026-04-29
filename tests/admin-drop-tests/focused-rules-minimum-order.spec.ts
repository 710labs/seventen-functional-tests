import { expect, test } from '@playwright/test'
import { SvntnCoreSettingsPage } from '../../models/admin/svntn-core-settings-page'
import type { PurchaseLimits } from '../../models/admin/svntn-core-settings-page'
import { FocusedRulesStorefrontPage } from '../../models/admin-drop/focused-rules-storefront-page'
import { focusedRulesFixture } from '../../utils/admin-drop/focused-rules-fixture'
import { resetCatalogWithFocusedRulesFixture } from '../../utils/admin-drop/import-focused-rules-fixture'

test('Focused rules pickup minimum order is enforced @admin-drop @rules @minorder', async ({
	page,
	browser,
}, testInfo) => {
	const { minimumOrderProduct, pickupMinimum, deliveryMinimum } = focusedRulesFixture
	const minimumOrderQuantity = Math.ceil(pickupMinimum / minimumOrderProduct.price)
	const settingsPage = new SvntnCoreSettingsPage(page)
	const cleanupErrors: string[] = []
	let originalPurchaseLimits: PurchaseLimits | undefined
	let mainError: unknown

	try {
		await resetCatalogWithFocusedRulesFixture(page, testInfo)

		await settingsPage.goto()
		originalPurchaseLimits = await settingsPage.getPurchaseLimits()
		await testInfo.attach('minimum-order-original-settings', {
			body: JSON.stringify(originalPurchaseLimits, null, 2),
			contentType: 'application/json',
		})

		await settingsPage.setAndSavePurchaseLimits({
			pickupMinimum: `${pickupMinimum}`,
			deliveryMinimum: `${deliveryMinimum}`,
		})
		await settingsPage.goto()
		const persistedPurchaseLimits = await settingsPage.getPurchaseLimits()
		await testInfo.attach('minimum-order-persisted-settings', {
			body: JSON.stringify(persistedPurchaseLimits, null, 2),
			contentType: 'application/json',
		})
		expect(persistedPurchaseLimits.pickupMinimum).toBe(`${pickupMinimum}`)
		expect(persistedPurchaseLimits.deliveryMinimum).toBe(`${deliveryMinimum}`)

		const storefrontContext = await browser.newContext({
			baseURL: process.env.BASE_URL,
		})
		const storefrontPage = await storefrontContext.newPage()
		const storefront = new FocusedRulesStorefrontPage(storefrontPage)

		try {
			await storefront.clearCart()
			await storefront.addProductBySku(minimumOrderProduct.sku, 1)
			await storefront.goToCart()

			const belowThresholdAttempt = await storefront.attemptCheckout()
			const belowThresholdText = `${belowThresholdAttempt.notices}\n${belowThresholdAttempt.bodyText}`
			await testInfo.attach('minimum-order-below-threshold-attempt', {
				body: JSON.stringify(
					{
						pickupMinimum,
						productPrice: minimumOrderProduct.price,
						quantity: 1,
						...belowThresholdAttempt,
					},
					null,
					2,
				),
				contentType: 'application/json',
			})
			expect(
				storefront.hasMinimumOrderBlockText(belowThresholdText, pickupMinimum),
				`Expected below-threshold pickup cart to show a minimum-order block for ${pickupMinimum}`,
			).toBe(true)

			await storefront.goToCart()
			await storefront.setCartQuantity(minimumOrderProduct.name, minimumOrderQuantity)
			const acceptedQuantity = await storefront.getCartQuantity(minimumOrderProduct.name)
			expect(acceptedQuantity).toBe(minimumOrderQuantity)

			const atOrAboveThresholdAttempt = await storefront.attemptCheckout()
			const atOrAboveThresholdStillBlocked = storefront.hasMinimumOrderBlockText(
				atOrAboveThresholdAttempt.notices,
				pickupMinimum,
			)
			const atOrAboveThresholdPath = new URL(atOrAboveThresholdAttempt.url).pathname
			const reachedCheckoutOrAccount =
				/\/checkout\/?$/.test(atOrAboveThresholdPath) ||
				/\/my-account\/?$/.test(atOrAboveThresholdPath) ||
				/checkout|complete your account|my account/i.test(atOrAboveThresholdAttempt.bodyText)

			await testInfo.attach('minimum-order-at-or-above-threshold-attempt', {
				body: JSON.stringify(
					{
						pickupMinimum,
						productPrice: minimumOrderProduct.price,
						quantity: minimumOrderQuantity,
						atOrAboveThresholdStillBlocked,
						reachedCheckoutOrAccount,
						...atOrAboveThresholdAttempt,
					},
					null,
					2,
				),
				contentType: 'application/json',
			})

			expect(
				atOrAboveThresholdStillBlocked,
				'Expected at/above-threshold pickup cart to clear the minimum-order block',
			).toBe(false)
			expect(
				reachedCheckoutOrAccount,
				'Expected at/above-threshold pickup cart to proceed past the cart minimum check',
			).toBe(true)
		} finally {
			await storefrontContext.close()
		}
	} catch (error) {
		mainError = error
	} finally {
		if (originalPurchaseLimits) {
			try {
				await settingsPage.goto()
				await settingsPage.setAndSavePurchaseLimits(originalPurchaseLimits)
				await settingsPage.goto()
				expect(await settingsPage.getPurchaseLimits()).toEqual(originalPurchaseLimits)
			} catch (cleanupError) {
				cleanupErrors.push(`${cleanupError}`)
			}
		}
	}

	expect(cleanupErrors, cleanupErrors.join('\n')).toEqual([])

	if (mainError) {
		throw mainError
	}
})
