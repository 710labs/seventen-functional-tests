import { expect, Locator, Page } from '@playwright/test'

function escapeCssAttributeValue(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Variable-weight products, such as Deli Flower, expose a data-portion-group on
 * their add-to-cart control. Select the first enabled portion in that group so
 * the same add flow continues to work for simple and variable products.
 */
export async function selectFirstAvailableProductPortion(
	page: Page,
	addToCartControl: Locator,
	productName: string,
) {
	const portionGroup = await addToCartControl.getAttribute('data-portion-group')

	if (!portionGroup) {
		return null
	}

	const escapedPortionGroup = escapeCssAttributeValue(portionGroup)
	const availablePortions = page.locator(
		`input.fasd-portion-radio[name="${escapedPortionGroup}"]:not(:disabled)`,
	)
	const availablePortionCount = await availablePortions.count()

	if (availablePortionCount === 0) {
		const normalizedProductName = productName.trim()
		throw new Error(
			[
				`Product "${normalizedProductName}" requires a portion selection,`,
				'but no enabled portions were available.',
			].join(' '),
		)
	}

	const checkedPortion = page.locator(
		`input.fasd-portion-radio[name="${escapedPortionGroup}"]:checked:not(:disabled)`,
	)
	const portion =
		(await checkedPortion.count()) > 0 ? checkedPortion.first() : availablePortions.first()

	if (!(await portion.isChecked())) {
		await portion.check({ force: true })
	}

	await expect(addToCartControl).toBeEnabled({ timeout: 5000 })

	const weightLabel =
		(await portion.getAttribute('data-weight-label')) ||
		(await portion.locator('xpath=ancestor::label[1]').textContent())?.trim() ||
		(await portion.getAttribute('value')) ||
		'first available portion'

	console.log(
		`Selected portion "${weightLabel}" for variable-weight product "${productName.trim()}".`,
	)

	return weightLabel
}
