import type { Page, TestInfo } from '@playwright/test'
import { ProductImporterPage } from '../../models/admin/product-importer-page'
import { focusedRulesFixture } from './focused-rules-fixture'

export async function resetCatalogWithFocusedRulesFixture(page: Page, testInfo: TestInfo) {
	const productImporterPage = new ProductImporterPage(page)

	await testInfo.attach('focused-rules-fixture', {
		body: JSON.stringify(
			{
				filePath: focusedRulesFixture.filePath,
				maxQuantityProduct: focusedRulesFixture.maxQuantityProduct,
				minimumOrderProduct: focusedRulesFixture.minimumOrderProduct,
				pickupMinimum: focusedRulesFixture.pickupMinimum,
				deliveryMinimum: focusedRulesFixture.deliveryMinimum,
			},
			null,
			2,
		),
		contentType: 'application/json',
	})

	const publishedProductsCleanupSummary = await productImporterPage.trashAllPublishedProducts()
	await testInfo.attach('focused-rules-published-products-reset-summary', {
		body: JSON.stringify(publishedProductsCleanupSummary, null, 2),
		contentType: 'application/json',
	})

	await productImporterPage.gotoImporter()
	await productImporterPage.uploadCsv(focusedRulesFixture.filePath)
	await productImporterPage.ensureUpdateExistingUnchecked()
	await productImporterPage.continueFromUpload()
	await productImporterPage.runImporterWithDefaultMapping()
	await productImporterPage.assertNoVisibleImportErrors()
}
