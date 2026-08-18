import { expect, Page, test } from '@playwright/test'
import { LiveNonProdHomePageActions } from '../../models/always-on/live-nonprod-homepage-actions.ts'
import { selectFirstAvailableDeliFlowerPortion } from '../../models/always-on/product-portions.ts'

async function setPortionMarkup(page: Page) {
	await page.setContent(`
		<fieldset class="fasd-portion-set" data-portion-group="portionId_pickup_1">
			<label>
				<input
					type="radio"
					class="fasd-portion-radio"
					name="portionId_pickup_1"
					data-weight-label="28g"
				/>
				Ounce
			</label>
			<label>
				<input
					type="radio"
					class="fasd-portion-radio"
					name="portionId_pickup_1"
					data-weight-label="14g"
				/>
				Half
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
	test('clicks the first enabled weight label before adding Deli Flower', async ({ page }) => {
		await setPortionMarkup(page)
		const addToCart = page.getByRole('button', { name: 'Add to cart' })

		const selectedPortion = await selectFirstAvailableDeliFlowerPortion(
			page,
			addToCart,
			'Deli Flower',
			'Z',
		)

		expect(selectedPortion).toBe('Ounce')
		await expect(page.getByRole('radio').first()).toBeChecked()
		await expect(addToCart).toBeEnabled()
	})

	test('clicks the next weight label when the first option is disabled', async ({ page }) => {
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

		expect(selectedPortion).toBe('Half')
		await expect(page.getByRole('radio').nth(1)).toBeChecked()
		await expect(addToCart).toBeEnabled()
	})

	test('selects another enabled label when the first radio remains checked', async ({ page }) => {
		await setPortionMarkup(page)
		const firstPortion = page.getByRole('radio').first()
		await firstPortion.check()
		const addToCart = page.getByRole('button', { name: 'Add to cart' })
		await addToCart.evaluate(button => {
			;(button as HTMLButtonElement).disabled = true
		})

		const selectedPortion = await selectFirstAvailableDeliFlowerPortion(
			page,
			addToCart,
			'Deli Flower',
			'Z',
		)

		expect(selectedPortion).toBe('Half')
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

test('re-adds the current Deli Flower product after registration', async ({ page }) => {
	await page.setContent(`
		<div class="summary entry-summary">
			<h1 class="product_title entry-title">Z</h1>
			<p class="product-subheading">Deli Flower</p>
			<fieldset data-portion-group="portionId_pickup_80534_8_1">
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portionId_pickup_80534_8_1"
						data-weight-label="28g"
					/>
					Ounce
				</label>
				<label>
					<input
						type="radio"
						class="fasd-portion-radio"
						name="portionId_pickup_80534_8_1"
						data-weight-label="14g"
					/>
					Half
				</label>
			</fieldset>
			<button data-portion-group="portionId_pickup_80534_8_1" disabled>Add to cart</button>
		</div>
		<div id="cartDrawer" style="display: none">
			<p>Z</p>
		</div>
		<script>
			document.querySelectorAll('.fasd-portion-radio').forEach(portion => {
				portion.addEventListener('change', () => {
					document.querySelector('button').disabled = false
				})
			})
			document.querySelector('button').addEventListener('click', () => {
				document.querySelector('#cartDrawer').style.display = 'block'
			})
		</script>
	`)

	const homePageActions = new LiveNonProdHomePageActions(page)
	await homePageActions.addCurrentProductToCartAfterRegistration(page)

	await expect(page.getByRole('radio').first()).toBeChecked()
	await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled()
	await expect(page.locator('#cartDrawer')).toBeVisible()
	await expect(page.locator('#cartDrawer')).toContainText('Z')
})
