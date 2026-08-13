import { expect, test } from '@playwright/test'
import { selectFirstAvailableProductPortion } from '../../models/always-on/product-portions.ts'

test.describe('variable-weight product portions', () => {
	test('selects the first enabled portion and enables add to cart', async ({ page }) => {
		await page.setContent(`
			<fieldset class="fasd-portion-set" data-portion-group="portionId_pickup_1">
				<legend>Choose weight</legend>
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portionId_pickup_1"
						value="small"
						data-weight-label="7g"
						disabled
					/>
					Quarter
				</label>
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portionId_pickup_1"
						value="medium"
						data-weight-label="14g"
					/>
					Half
				</label>
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portionId_pickup_1"
						value="large"
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

		const addToCart = page.getByRole('button', { name: 'Add to cart' })
		const selectedWeight = await selectFirstAvailableProductPortion(
			page,
			addToCart,
			'Garlic Cocktail #7',
		)

		await expect(page.locator('input[data-weight-label="14g"]')).toBeChecked()
		await expect(addToCart).toBeEnabled()
		expect(selectedWeight).toBe('14g')
	})

	test('leaves simple products unchanged', async ({ page }) => {
		await page.setContent('<button>Add to cart</button>')
		const addToCart = page.getByRole('button', { name: 'Add to cart' })

		expect(
			await selectFirstAvailableProductPortion(page, addToCart, 'Rambutan #11'),
		).toBeNull()
		await expect(addToCart).toBeEnabled()
	})
})
