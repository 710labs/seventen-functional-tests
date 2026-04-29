import test, { expect, Locator, Page } from '@playwright/test'

export type ProductFieldSnapshot = {
	source: string
	value: string
}

export class AdminProductsPage {
	readonly page: Page
	readonly productRows: Locator

	constructor(page: Page) {
		this.page = page
		this.productRows = page.locator('#the-list tr[id^="post-"]')
	}

	async openProductEditBySku(sku: string) {
		await test.step(`Open product edit screen for SKU ${sku}`, async () => {
			await this.page.goto(
				`/wp-admin/edit.php?post_status=publish&post_type=product&s=${encodeURIComponent(sku)}`,
			)
			await expect(this.page).toHaveURL(/post_type=product/)

			const productRow = this.productRows.filter({ hasText: sku }).first()
			await expect(productRow, `Expected to find a published product row for SKU ${sku}`).toBeVisible()

			const editLink = productRow.locator('a.row-title').first()
			await expect(editLink, `Expected an edit link for SKU ${sku}`).toBeVisible()
			await editLink.click()
			await this.page.waitForLoadState('networkidle').catch(() => {})
			await expect(this.page).toHaveURL(/post\.php\?post=\d+&action=edit/)
		})
	}

	async getVisibleMaxQuantityFieldSnapshots(): Promise<ProductFieldSnapshot[]> {
		return test.step('Inspect visible product max quantity fields', async () => {
			const snapshots: ProductFieldSnapshot[] = []
			const selectorCandidates = [
				'input[name="_isa_wc_max_qty_product_max"]',
				'input[name*="isa_wc_max_qty_product_max"]',
				'input[id*="isa_wc_max_qty_product_max"]',
				'input[name*="max_qty"]',
				'input[id*="max_qty"]',
				'input[name*="maximum_quantity"]',
				'input[id*="maximum_quantity"]',
				'input[name*="quantity_max"]',
				'input[id*="quantity_max"]',
			]

			for (const selector of selectorCandidates) {
				const fields = this.page.locator(selector)
				const count = await fields.count()

				for (let index = 0; index < count; index += 1) {
					const field = fields.nth(index)
					const isVisible = await field.isVisible().catch(() => false)

					if (!isVisible) {
						continue
					}

					snapshots.push({
						source: `${selector} >> nth=${index}`,
						value: await field.inputValue(),
					})
				}
			}

			const labelCandidate = this.page
				.getByLabel(/maximum quantity|max quantity|quantity limit|product maximum/i)
				.first()
			const labelCandidateVisible = await labelCandidate.isVisible().catch(() => false)

			if (labelCandidateVisible) {
				snapshots.push({
					source: 'label:/maximum quantity|max quantity|quantity limit|product maximum/i',
					value: await labelCandidate.inputValue(),
				})
			}

			return this.dedupeSnapshots(snapshots)
		})
	}

	private dedupeSnapshots(snapshots: ProductFieldSnapshot[]) {
		const seen = new Set<string>()

		return snapshots.filter(snapshot => {
			const key = `${snapshot.source}:${snapshot.value}`

			if (seen.has(key)) {
				return false
			}

			seen.add(key)
			return true
		})
	}
}
