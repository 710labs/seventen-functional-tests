import { expect, type Locator } from '@playwright/test'

export type ExpectedDiscountLine = {
	label: string
	amount: number
	categoryId?: number
	couponKey?: string
}

export type ExpectedOrderPricing = {
	subtotal: number
	discountLines: ExpectedDiscountLine[]
	bulkTotal: number
	accountTotal: number
	gross?: number
	excise?: number
	sales?: number
	taxLines?: { label: string; amount: number }[]
	total: number
}

export function moneyInCents(text: string, allowWholeDollars = false): number {
	const pattern = allowWholeDollars
		? /^\$?\s*(\d+)(?:\.(\d{2}))?$/
		: /^-?\s*\$?\s*(\d+)\.(\d{2})$/
	const match = text.replace(/,/g, '').trim().match(pattern)
	if (!match) throw new Error('Expected a single valid currency amount')
	const value = Number(match[1]) * 100 + Number(match[2] || 0)
	if (!Number.isSafeInteger(value)) throw new Error('Currency amount exceeds integer precision')
	return value
}

// Shared by cart and checkout. This assertion deliberately ignores BYPASS_TAX_CALC:
// a discount test must verify the discounted tax base even when legacy tests skip it.
export async function verifyOrderPricing(summary: Locator, expected: ExpectedOrderPricing) {
	await expect(summary).toBeVisible()
	const discountRows = summary.locator('tr.cart-discount')
	await expect(discountRows).toHaveCount(expected.discountLines.length)
	const expectedDiscounts = expected.discountLines.map(line => ({ label: line.label.toLowerCase(), amount: line.amount }))
		.sort((a, b) => a.label.localeCompare(b.label))
	await expect.poll(async () => {
		const discounts = []
		for (const row of await discountRows.all()) {
			const label = (await row.locator('th').innerText()).replace(/^coupon:\s*/i, '').replace(/\s+/g, ' ').trim().toLowerCase()
			discounts.push({ label, amount: moneyInCents(await row.locator('.amount').first().innerText()) })
		}
		return discounts.sort((a, b) => a.label.localeCompare(b.label))
	}, { message: 'Discount labels and amounts must match the configured rules' }).toEqual(expectedDiscounts)
	for (const discount of expected.discountLines.filter(line => line.couponKey)) {
		const row = discountRows.filter({ has: summary.page().getByText(discount.label, { exact: true }) })
		await expect(row).toHaveClass(new RegExp(`(?:^|\\s)coupon-${discount.couponKey!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`))
	}
	await expect.poll(async () => moneyInCents(await summary.locator('tr.cart-subtotal .amount').first().innerText())).toBe(expected.subtotal)
	const taxes = expected.taxLines ?? ['gross', 'excise', 'sales'].map(key => ({ label: key, amount: expected[key] }))
	await expect(summary.locator('tr.tax-rate')).toHaveCount(taxes.length)
	for (const tax of taxes) {
		const label = tax.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		const row = expected.taxLines
			? summary.locator('tr.tax-rate').filter({ has: summary.page().locator('th').filter({ hasText: new RegExp(`^\\s*${label}(?:\\s*\\(estimated for [\\s\\S]*\\))?\\s*$`, 'i') }) })
			: summary.locator('tr.tax-rate').filter({ hasText: new RegExp(label, 'i') })
		await expect(row, `Exactly one ${tax.label} tax line is expected`).toHaveCount(1)
		await expect.poll(async () => moneyInCents(await row.locator('.amount').first().innerText()), { message: `${tax.label} tax on discounted subtotal` }).toBe(tax.amount)
	}
	await expect.poll(async () => moneyInCents(await summary.locator('tr.order-total .amount').first().innerText()), { message: 'Discounted order total' }).toBe(expected.total)
	// Coupon Remove controls are intentionally outside bulk-pricing coverage.
}
