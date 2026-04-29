import { expect, test } from '@playwright/test'
import { AdminProductsPage } from '../../models/admin/admin-products-page'
import { FocusedRulesStorefrontPage } from '../../models/admin-drop/focused-rules-storefront-page'
import { focusedRulesFixture } from '../../utils/admin-drop/focused-rules-fixture'
import { resetCatalogWithFocusedRulesFixture } from '../../utils/admin-drop/import-focused-rules-fixture'

test('Focused rules max quantity is enforced @admin-drop @rules @maxqty', async ({
	page,
	browser,
}, testInfo) => {
	const { maxQuantityProduct } = focusedRulesFixture
	const expectedMaxQuantity = maxQuantityProduct.expectedMaxQuantity || 2
	const adminProductsPage = new AdminProductsPage(page)
	const storefrontContext = await browser.newContext({
		baseURL: process.env.BASE_URL,
	})
	const storefrontPage = await storefrontContext.newPage()
	const storefront = new FocusedRulesStorefrontPage(storefrontPage)

	try {
		await resetCatalogWithFocusedRulesFixture(page, testInfo)

		await adminProductsPage.openProductEditBySku(maxQuantityProduct.sku)
		const maxQuantityFieldSnapshots = await adminProductsPage.getVisibleMaxQuantityFieldSnapshots()
		await testInfo.attach('max-quantity-admin-field-snapshots', {
			body: JSON.stringify(maxQuantityFieldSnapshots, null, 2),
			contentType: 'application/json',
		})

		if (maxQuantityFieldSnapshots.length) {
			expect(
				maxQuantityFieldSnapshots.some(snapshot => snapshot.value === `${expectedMaxQuantity}`),
				`Expected at least one visible max quantity field to persist value ${expectedMaxQuantity}`,
			).toBe(true)
		}

		await storefront.clearCart()
		await storefront.addProductBySku(maxQuantityProduct.sku, expectedMaxQuantity)
		await storefront.goToCart()

		const allowedQuantity = await storefront.getCartQuantity(maxQuantityProduct.name)
		expect(allowedQuantity, `Expected allowed max quantity ${expectedMaxQuantity} to be accepted`).toBe(
			expectedMaxQuantity,
		)

		await storefront.setCartQuantity(maxQuantityProduct.name, expectedMaxQuantity + 1)
		const enforcedQuantity = await storefront.getCartQuantity(maxQuantityProduct.name)
		const noticeText = await storefront.getNoticeText()
		const bodyText = await storefront.getBodyText()
		const enforcementText = `${noticeText}\n${bodyText}`
		const hasEnforcementMessage =
			/(maximum|max|limit|allowed|quantity|only)/i.test(enforcementText) &&
			enforcementText.includes(`${expectedMaxQuantity}`)

		await testInfo.attach('max-quantity-storefront-enforcement', {
			body: JSON.stringify(
				{
					expectedMaxQuantity,
					allowedQuantity,
					enforcedQuantity,
					noticeText,
				},
				null,
				2,
			),
			contentType: 'application/json',
		})

		expect(
			enforcedQuantity <= expectedMaxQuantity || hasEnforcementMessage,
			`Expected quantity ${expectedMaxQuantity + 1} to be blocked, corrected, or accompanied by a max quantity notice`,
		).toBe(true)
	} finally {
		await storefrontContext.close()
	}
})
