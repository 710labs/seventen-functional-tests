import path from 'path'
import test, { expect, Locator, Page } from '@playwright/test'

const visibleImporterErrorSelector = [
	'.notice.notice-error:visible',
	'.notice-error:visible',
	'.woocommerce-error:visible',
	'.woocommerce-importer-error-log:visible',
	'.wc-importer-error-log:visible',
	'.importer-error-log:visible',
].join(', ')
const productsPageUrl = '/wp-admin/edit.php?post_status=publish&post_type=product&paged=1'
const maxPublishedProductTrashIterations = 50

export type PublishedProductsCleanupSummary = {
	iterations: number
	trashedBatches: number[]
	startedWithRows: number
	finishedWithRows: number
}

export class ProductImporterPage {
	readonly page: Page
	readonly importerForm: Locator
	readonly uploadInput: Locator
	readonly updateExistingCheckbox: Locator
	readonly continueButton: Locator
	readonly runImporterButton: Locator
	readonly activeStep: Locator
	readonly visibleImporterErrors: Locator
	readonly publishedProductRows: Locator
	readonly emptyProductsState: Locator
	readonly topSelectAllCheckbox: Locator
	readonly topBulkActionSelect: Locator
	readonly topApplyBulkActionButton: Locator
	readonly topDisplayingNum: Locator
	readonly publishedTabCount: Locator
	readonly trashSuccessNotice: Locator

	constructor(page: Page) {
		this.page = page
		this.importerForm = page.locator('form.woocommerce-importer')
		this.uploadInput = page.locator('#upload')
		this.updateExistingCheckbox = page.locator('#woocommerce-importer-update-existing')
		this.continueButton = page.locator('button[name="save_step"].button-next')
		this.runImporterButton = page.getByRole('button', { name: /run the importer/i })
		this.activeStep = page.locator('.wc-progress-steps li.active')
		this.visibleImporterErrors = page.locator(visibleImporterErrorSelector)
		this.publishedProductRows = page.locator('#the-list tr[id^="post-"]')
		this.emptyProductsState = page.locator('#the-list .no-items')
		this.topSelectAllCheckbox = page.locator('#cb-select-all-1')
		this.topBulkActionSelect = page.locator('#bulk-action-selector-top')
		this.topApplyBulkActionButton = page.locator('#doaction')
		this.topDisplayingNum = page.locator('.tablenav.top .displaying-num').first()
		this.publishedTabCount = page.locator('.subsubsub .publish .count')
		this.trashSuccessNotice = page
			.locator('.notice.notice-success, .updated.notice, .updated')
			.filter({ hasText: /moved to the Trash/i })
	}

	async gotoProducts() {
		await test.step('Open WooCommerce products page', async () => {
			await this.page.goto(productsPageUrl)
			await expect(this.page).toHaveURL(/post_status=publish.*post_type=product|post_type=product.*post_status=publish/)
			await expect(this.page.getByRole('link', { name: /import/i }).first()).toBeVisible()
		})
	}

	async gotoImporter() {
		await test.step('Open WooCommerce product importer', async () => {
			await this.page.goto('/wp-admin/edit.php?post_type=product&page=product_importer')
			await expect(this.page).toHaveURL(/page=product_importer/)
			await expect(this.importerForm).toBeVisible()
			await expect(this.uploadInput).toBeVisible()
			await expect(this.continueButton).toBeVisible()
		})
	}

	async uploadCsv(filePath: string) {
		await test.step(`Upload CSV fixture ${path.basename(filePath)}`, async () => {
			await this.uploadInput.setInputFiles(filePath)
			await expect
				.poll(async () => {
					return this.uploadInput.evaluate(input => {
						if (!(input instanceof HTMLInputElement) || !input.files?.length) {
							return ''
						}

						return input.files[0]?.name || ''
					})
				})
				.toBe(path.basename(filePath))
		})
	}

	async ensureUpdateExistingUnchecked() {
		await test.step('Keep "Update existing products" unchecked', async () => {
			if (await this.updateExistingCheckbox.isChecked()) {
				await this.updateExistingCheckbox.uncheck()
			}

			await expect(this.updateExistingCheckbox).not.toBeChecked()
		})
	}

	async continueFromUpload() {
		await test.step('Continue from CSV upload to column mapping', async () => {
			await this.continueButton.click()
			await expect
				.poll(async () => (await this.activeStep.textContent())?.trim() || '')
				.toContain('Column mapping')
		})
	}

	async runImporterWithDefaultMapping() {
		await test.step('Run WooCommerce importer with default column mapping', async () => {
			const importerButtonVisible = await this.runImporterButton.isVisible().catch(() => false)

			if (importerButtonVisible) {
				await this.runImporterButton.click()
			} else {
				await this.continueButton.click()
			}

			await expect
				.poll(async () => (await this.activeStep.textContent())?.trim() || '', {
					timeout: 2 * 60 * 1000,
				})
				.toContain('Done!')
		})
	}

	async assertNoVisibleImportErrors() {
		await test.step('Verify importer completed without visible fatal or row-level errors', async () => {
			await expect(this.visibleImporterErrors).toHaveCount(0)

			for (const failureText of [/failed to import/i, /import failed/i, /errors found/i]) {
				const isVisible = await this.page.getByText(failureText).first().isVisible().catch(() => false)
				expect(
					isVisible,
					`Expected no visible importer failure text matching ${failureText.toString()}`,
				).toBe(false)
			}
		})
	}

	async trashAllPublishedProducts(): Promise<PublishedProductsCleanupSummary> {
		return test.step('Trash all currently published products before import', async () => {
			await this.gotoProducts()

			const summary: PublishedProductsCleanupSummary = {
				iterations: 0,
				trashedBatches: [],
				startedWithRows: await this.getPublishedProductsTotalCount(),
				finishedWithRows: 0,
			}

			for (let iteration = 0; iteration < maxPublishedProductTrashIterations; iteration += 1) {
				const currentTotalCount = await this.getPublishedProductsTotalCount()

				if (currentTotalCount === 0 || (await this.hasNoPublishedProducts())) {
					summary.finishedWithRows = 0
					return summary
				}

				const visibleRowCount = await this.publishedProductRows.count()
				expect(visibleRowCount, 'Expected at least one published product row before bulk trash').toBeGreaterThan(0)

				summary.iterations += 1
				summary.trashedBatches.push(visibleRowCount)

				await this.topSelectAllCheckbox.check()
				await expect(this.topSelectAllCheckbox).toBeChecked()
				await this.topBulkActionSelect.selectOption('trash')
				await this.topApplyBulkActionButton.click()

				await expect(this.page).toHaveURL(/post_type=product/)

				let nextTotalCount = currentTotalCount
				await expect
					.poll(
						async () => {
							nextTotalCount = await this.getPublishedProductsTotalCount()
							return nextTotalCount
						},
						{
							timeout: 60 * 1000,
							message: `Expected published product count to decrease after moving ${visibleRowCount} products to Trash`,
						},
					)
					.toBeLessThan(currentTotalCount)

				const sawTrashNotice = await this.trashSuccessNotice.first().isVisible().catch(() => false)
				expect(
					sawTrashNotice || nextTotalCount < currentTotalCount,
					`Expected a trash success notice or lower published count after bulk trash. Previous total: ${currentTotalCount}, next total: ${nextTotalCount}`,
				).toBe(true)

				await this.page.goto(productsPageUrl)
			}

			summary.finishedWithRows = await this.getPublishedProductsTotalCount()
			expect(
				summary.finishedWithRows,
				`Published products were not fully cleared after ${maxPublishedProductTrashIterations} iterations`,
			).toBe(0)

			return summary
		})
	}

	private async hasNoPublishedProducts() {
		const emptyStateVisible = await this.emptyProductsState.first().isVisible().catch(() => false)

		if (emptyStateVisible) {
			return true
		}

		return (await this.publishedProductRows.count()) === 0
	}

	private async getPublishedProductsTotalCount() {
		if (await this.hasNoPublishedProducts()) {
			return 0
		}

		const displayingNumText = await this.topDisplayingNum.textContent()
		const displayingNumCount = this.parseCount(displayingNumText)

		if (displayingNumCount !== null) {
			return displayingNumCount
		}

		const publishedTabCountText = await this.publishedTabCount.textContent()
		const publishedTabCount = this.parseCount(publishedTabCountText)

		if (publishedTabCount !== null) {
			return publishedTabCount
		}

		return this.publishedProductRows.count()
	}

	private parseCount(text: string | null) {
		if (!text) {
			return null
		}

		const match = text.match(/\d[\d,]*/)

		if (!match) {
			return null
		}

		return Number.parseInt(match[0].replace(/,/g, ''), 10)
	}
}
