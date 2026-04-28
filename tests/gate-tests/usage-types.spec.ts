import { expect, test } from '@playwright/test'
import { calculateCartTotals } from '../../utils/order-calculations'
import {
	getRatesBucketForUsage,
	getUsageLabel,
	normalizeUsageType,
} from '../../utils/usage-types'

const californiaRatesFixture = {
	standard: [
		{ rate: 6, label: 'County Gross Tax', shipping: 'no', compound: 'yes' },
		{ rate: 15, label: 'California Excise Tax', shipping: 'no', compound: 'yes' },
		{ rate: 9.5, label: 'Sales', shipping: 'no', compound: 'yes' },
	],
	'medical-rate': [
		{ rate: 5, label: 'Gross', shipping: 'no', compound: 'yes' },
		{ rate: 15, label: 'Excise', shipping: 'no', compound: 'yes' },
		{ rate: 9.5, label: 'Sales', shipping: 'no', compound: 'yes' },
	],
}

test.describe('Usage Type Helpers', () => {
	test('normalizes capitalized usage values to the shared internal contract', async () => {
		expect(normalizeUsageType('Medical')).toBe('medical')
		expect(normalizeUsageType('Recreational')).toBe('recreational')
		expect(getUsageLabel('medical')).toBe('Medical')
		expect(getUsageLabel('recreational')).toBe('Recreational')
	})

	test('maps recreational and medical usage to the correct tax-rate buckets', async () => {
		expect(getRatesBucketForUsage('recreational')).toBe('standard')
		expect(getRatesBucketForUsage('medical')).toBe('medical-rate')
	})

	test('calculates different totals for recreational and medical usage from the same cart', async () => {
		const productItems = [{ subTotal: '100.00' }]
		const recreationalTotals = await calculateCartTotals(
			californiaRatesFixture,
			productItems,
			'recreational',
		)
		const medicalTotals = await calculateCartTotals(
			californiaRatesFixture,
			productItems,
			'medical',
		)

		expect(recreationalTotals.expectedGrossTaxAmount).toBe('6')
		expect(medicalTotals.expectedGrossTaxAmount).toBe('5')
		expect(recreationalTotals.expectedTotal).not.toBe(medicalTotals.expectedTotal)
	})
})
