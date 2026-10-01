import { expect, test } from '@playwright/test'
import {
	ProductCandidate,
	selectNextLiveProductCandidate,
} from '../../models/always-on/live-nonprod-cart-flow.ts'

function candidate(name: string, isMedical: boolean): ProductCandidate {
	return {
		category: 'Flower',
		facility: '1',
		fulfillmentMethod: 'pickup',
		index: 0,
		isMedical,
		key: name,
		name,
		storefrontUrl: 'https://live-dev.710labs.com/shop/710-labs-culver-city/',
	}
}

test.describe('Live product candidate selection', () => {
	test('MED orders prefer medical-only inventory', () => {
		const recreational = candidate('Moonbow', false)
		const medical = candidate('Medical Moonbow', true)

		expect(
			selectNextLiveProductCandidate(
				[recreational, medical],
				'med',
				new Map(),
				false,
			),
		).toBe(medical)
	})

	test('MED orders fall back to recreational inventory when medical products are absent', () => {
		const recreational = candidate('Moonbow', false)

		expect(
			selectNextLiveProductCandidate([recreational], 'med', new Map(), false),
		).toBe(recreational)
	})

	test('MED orders fall back after medical product attempts are exhausted', () => {
		const recreational = candidate('Moonbow', false)
		const medical = candidate('Medical Moonbow', true)
		const attempts = new Map([[medical.key, 2]])

		expect(
			selectNextLiveProductCandidate(
				[medical, recreational],
				'med',
				attempts,
				false,
			),
		).toBe(recreational)
	})

	test('recreational orders never select medical-only inventory', () => {
		const medical = candidate('Medical Moonbow', true)

		expect(
			selectNextLiveProductCandidate([medical], 'rec', new Map(), false),
		).toBeUndefined()
	})

	test('reuses a product that added successfully after its second attempt', () => {
		const recreational = candidate('Moonbow', false)
		const attempts = new Map([[recreational.key, 2]])

		expect(
			selectNextLiveProductCandidate(
				[recreational],
				'rec',
				attempts,
				false,
				new Set([recreational.key]),
			),
		).toBe(recreational)
	})

	test('moves to the next product after an inventory rejection', () => {
		const unavailable = candidate('Moonbow', false)
		const available = candidate('Z', false)

		expect(
			selectNextLiveProductCandidate(
				[unavailable, available],
				'rec',
				new Map([[unavailable.key, 1]]),
				false,
				new Set(),
				new Set([unavailable.key]),
			),
		).toBe(available)
	})
})
