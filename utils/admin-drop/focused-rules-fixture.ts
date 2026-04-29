import path from 'path'

export type FocusedRulesProductFixture = {
	sku: string
	name: string
	price: number
	expectedMaxQuantity?: number
}

export type FocusedRulesFixture = {
	filePath: string
	maxQuantityProduct: FocusedRulesProductFixture
	minimumOrderProduct: FocusedRulesProductFixture
	pickupMinimum: number
	deliveryMinimum: number
}

export const focusedRulesFixture: FocusedRulesFixture = {
	filePath: path.join(
		__dirname,
		'../../tests/admin-drop-tests/fixtures/focused-rules/focused-rules-wave1.csv',
	),
	maxQuantityProduct: {
		sku: 'ADMIN_PHASE3_MAXQTY',
		name: 'ZZ Admin Drop Phase 3 Max Qty',
		price: 60,
		expectedMaxQuantity: 2,
	},
	minimumOrderProduct: {
		sku: 'ADMIN_PHASE3_MINORDER',
		name: 'ZZ Admin Drop Phase 3 Min Order',
		price: 75,
	},
	pickupMinimum: 150,
	deliveryMinimum: 150,
}
