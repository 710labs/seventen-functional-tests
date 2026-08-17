import { expect, Page, test } from '@playwright/test'
import { selectFirstAvailableDeliFlowerPortion } from '../../models/always-on/product-portions.ts'

async function setPortionMarkup(page: Page) {
	await page.setContent(`
		<fieldset class="fasd-portion-set" data-portion-group="portionId_pickup_1">
			<label>
				<input
					type="radio"
					class="fasd-portion-radio"
					name="portionId_pickup_1"
					data-weight-label="14g"
				/>
				Half
			</label>
			<label>
				<input
					type="radio"
					class="fasd-portion-radio"
					name="portionId_pickup_1"
					data-weight-label="28g"
				/>
				Ounce
			</label>
		</fieldset>
		<button data-portion-group="portionId_pickup_1" disabled>Add to cart</button>
		<script>
			document.querySelectorAll('.fasd-portion-radio').forEach(portion => {
				portion.addEventListener('change', () => {
					document.querySelector('button').disabled = false
				})
			})
		</script>
	`)
}

test.describe('Deli Flower product portions', () => {
	test('selects Half before adding Deli Flower to the cart', async ({ page }) => {
		await setPortionMarkup(page)
		const addToCart = page.getByRole('button', { name: 'Add to cart' })

		const selectedPortion = await selectFirstAvailableDeliFlowerPortion(
			page,
			addToCart,
			'Deli Flower',
			'Z',
		)

		expect(selectedPortion).toBe('Half')
		await expect(page.getByRole('radio').first()).toBeChecked()
		await expect(addToCart).toBeEnabled()
	})

	test('selects Ounce when Half is disabled', async ({ page }) => {
		await setPortionMarkup(page)
		await page.getByRole('radio').first().evaluate(input => {
			;(input as HTMLInputElement).disabled = true
		})
		const addToCart = page.getByRole('button', { name: 'Add to cart' })

		const selectedPortion = await selectFirstAvailableDeliFlowerPortion(
			page,
			addToCart,
			'Deli Flower',
			'Z',
		)

		expect(selectedPortion).toBe('Ounce')
		await expect(page.getByRole('radio').nth(1)).toBeChecked()
		await expect(addToCart).toBeEnabled()
	})

	test('does not select a portion for other product categories', async ({ page }) => {
		await setPortionMarkup(page)
		const addToCart = page.getByRole('button', { name: 'Add to cart' })

		expect(
			await selectFirstAvailableDeliFlowerPortion(
				page,
				addToCart,
				'Flower',
				'Rambutan #11',
			),
		).toBeNull()
		await expect(page.getByRole('radio').first()).not.toBeChecked()
		await expect(addToCart).toBeDisabled()
	})
})
