import { test } from '@playwright/test'
import type { CartPage } from '../models/cart-page'
import {
	RecreationalInventoryUnavailableError,
	type ShopFulfillment,
	type ShopPage,
} from '../models/shop-page'

export async function buildListOrderCart(
	shop: ShopPage,
	cart: CartPage,
	fulfillment: ShopFulfillment,
	{ initialItemCount = 4, cartButtonDestination }: {
		initialItemCount?: number
		cartButtonDestination?: string
	} = {},
) {
	try {
		await shop.addProductsUntilCheckoutReady(
			cart,
			initialItemCount,
			fulfillment,
			cart.usageType,
			cartButtonDestination,
		)
	} catch (error) {
		if (!(error instanceof RecreationalInventoryUnavailableError)) throw error
		test.skip(true, `Recreational registration passed. Checkout skipped. ${error.message}`)
	}
}
