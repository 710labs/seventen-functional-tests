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
	{ initialItemCount = 4, cartButtonDestination, allowWaitlist = false }: {
		initialItemCount?: number
		cartButtonDestination?: string
		allowWaitlist?: boolean
	} = {},
): Promise<'checkout' | 'waitlist'> {
	try {
		return await shop.addProductsUntilCheckoutReady(
			cart,
			initialItemCount,
			fulfillment,
			cart.usageType,
			{ cartButtonDestination, allowWaitlist },
		)
	} catch (error) {
		if (error instanceof RecreationalInventoryUnavailableError) {
			test.skip(true, `Recreational registration passed. Checkout skipped. ${error.message}`)
		}
		throw error
	}
}
