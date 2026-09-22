import { expect, Locator, Page } from '@playwright/test'

const cartNoticeSelector = [
	'.woocommerce-error',
	'.wc-block-components-notice-banner',
	'.wpse-snacktoast',
	'[role="alert"]',
].join(', ')

function escapeCssAttributeValue(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function isInsufficientInventoryNotice(text: string) {
	const normalizedText = text.replace(/\s+/g, ' ').trim()

	return [
		/\bnot enough available\b/i,
		/\bonly\s+\d+(?:\.\d+)?\s*[a-z]*\s+(?:of\s+this\s+product\s+)?(?:is\s+)?left\b/i,
		/\binsufficient (?:inventory|stock)\b/i,
		/\bout of stock\b/i,
		/\bcannot add\b.*\b(?:available|inventory|stock)\b/i,
	].some(pattern => pattern.test(normalizedText))
}

export async function getVisibleInsufficientInventoryNotice(page: Page) {
	const notices = page.locator(cartNoticeSelector)
	const noticeCount = await notices.count()

	for (let index = 0; index < noticeCount; index += 1) {
		const notice = notices.nth(index)

		if (!(await notice.isVisible().catch(() => false))) {
			continue
		}

		const text = ((await notice.textContent().catch(() => '')) || '')
			.replace(/\s+/g, ' ')
			.trim()

		if (isInsufficientInventoryNotice(text)) {
			return text
		}
	}

	return null
}

export async function selectFirstAvailableDeliFlowerPortion(
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
		throw new Error(
			`Deli Flower product "${productName.trim()}" has no enabled weight portions.`,
		)
	}

	let portionIndex = 0

	for (let index = 0; index < availablePortionCount; index += 1) {
		if (!(await availablePortions.nth(index).isChecked())) {
			portionIndex = index
			break
		}
	}

	const portion = availablePortions.nth(portionIndex)
	const portionLabel = portion.locator('xpath=ancestor::label[1]')

	await expect(portionLabel).toBeVisible()
	await portionLabel.click()
	await expect(portion).toBeChecked()
	await expect(addToCartControl).toBeEnabled({ timeout: 5000 })

	const weightLabel =
		(await portionLabel.textContent())?.trim() ||
		(await portion.getAttribute('data-weight-label')) ||
		(await portion.getAttribute('value')) ||
		'first available portion'

	console.log(
		`Selected Deli Flower portion "${weightLabel}" for product "${productName.trim()}".`,
	)

	return weightLabel
}
