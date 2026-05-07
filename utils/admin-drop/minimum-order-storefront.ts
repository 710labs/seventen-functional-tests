import test from '@playwright/test'
import {
	ShopPage,
	type MinimumOrderBannerState,
	type ShopFulfillment,
	type StorefrontCheckoutState,
	type StorefrontProductCandidate,
} from '../../models/shop-page'
import { type TestUsageType } from '../usage-types'

export type MinimumOrderStorefrontOptions = {
	fulfillment: ShopFulfillment
	configuredMinimum: number
	usage?: TestUsageType
	maxAddIterations?: number
}

export type MinimumOrderStorefrontDiagnostics = {
	fulfillment: ShopFulfillment
	configuredMinimum: number
	subtotalProgression: number[]
	bannerTexts: string[]
	remainingAmounts: number[]
	addedProducts: StorefrontProductCandidate[]
	checkoutState: StorefrontCheckoutState
	finalUrl: string
}

function recordBanner(
	banner: MinimumOrderBannerState,
	bannerTexts: string[],
	remainingAmounts: number[],
) {
	if (banner.text) {
		bannerTexts.push(banner.text)
	}

	if (banner.remainingAmount !== null) {
		remainingAmounts.push(banner.remainingAmount)
	}
}

function formatProducts(products: StorefrontProductCandidate[]) {
	return products
		.map(product => {
			const sku = product.sku ? ` sku=${product.sku}` : ''
			return `index=${product.menuIndex}${sku} name="${product.name}" price=${product.price}`
		})
		.join('\n')
}

function roundedMoney(value: number) {
	return Math.round(value * 100) / 100
}

function assertBlockedMinimumBanner(
	banner: MinimumOrderBannerState,
	configuredMinimum: number,
	subtotal: number,
) {
	if (!banner.isVisible || !banner.text) {
		throw new Error(
			[
				'Expected minimum-order banner while cart subtotal was below the configured minimum.',
				`Configured minimum: ${configuredMinimum}`,
				`Cart subtotal: ${subtotal}`,
				`Expected remaining: ${roundedMoney(configuredMinimum - subtotal)}`,
				'Banner text: <none>',
			].join('\n'),
		)
	}

	if (banner.remainingAmount === null) {
		throw new Error(
			[
				'Expected minimum-order banner to include an "Add $X to check out" amount.',
				`Configured minimum: ${configuredMinimum}`,
				`Cart subtotal: ${subtotal}`,
				`Expected remaining: ${roundedMoney(configuredMinimum - subtotal)}`,
				`Banner text: ${banner.text}`,
			].join('\n'),
		)
	}

	const expectedRemaining = roundedMoney(configuredMinimum - subtotal)
	const observedRemaining = roundedMoney(banner.remainingAmount)

	if (Math.abs(observedRemaining - expectedRemaining) > 0.01) {
		throw new Error(
			[
				'Minimum-order banner remaining amount did not match configured minimum minus cart subtotal.',
				`Configured minimum: ${configuredMinimum}`,
				`Cart subtotal: ${subtotal}`,
				`Expected remaining: ${expectedRemaining}`,
				`Observed remaining: ${observedRemaining}`,
				`Banner text: ${banner.text}`,
			].join('\n'),
		)
	}
}

export async function satisfyMinimumOrderFromStorefront(
	shopPage: ShopPage,
	options: MinimumOrderStorefrontOptions,
): Promise<MinimumOrderStorefrontDiagnostics> {
	const usage = options.usage || 'recreational'
	const maxAddIterations = options.maxAddIterations || 20
	const subtotalProgression: number[] = []
	const bannerTexts: string[] = []
	const remainingAmounts: number[] = []
	const addedProducts: StorefrontProductCandidate[] = []

	return test.step('Satisfy storefront minimum order from uploaded menu', async () => {
		await shopPage.clearStorefrontCart()
		await shopPage.openStorefrontForFulfillment(options.fulfillment)

		const initialCandidates = await shopPage.getAddableStorefrontProducts(usage)
		const firstProduct = initialCandidates.find(
			product => product.price > 0 && product.price < options.configuredMinimum,
		)

		if (!firstProduct) {
			throw new Error(
				[
					`Could not find an addable ${usage} storefront product priced below configured minimum ${options.configuredMinimum}.`,
					'Minimum-order smoke needs one below-minimum product for the initial under-minimum assertion.',
					`Addable products inspected: ${initialCandidates.length}`,
					formatProducts(initialCandidates) || 'No addable products found.',
				].join('\n'),
			)
		}

		await shopPage.addStorefrontProduct(firstProduct, usage)
		addedProducts.push(firstProduct)
		await shopPage.goToCart({ requireItems: true })

		const firstSubtotal = await shopPage.getCartSubtotalAmount()
		subtotalProgression.push(firstSubtotal)

		const firstBanner = await shopPage.getMinimumOrderBannerState()
		recordBanner(firstBanner, bannerTexts, remainingAmounts)

		if (firstSubtotal >= options.configuredMinimum) {
			throw new Error(
				[
					'Minimum-order precondition failed after adding the first uploaded-menu product.',
					`Expected first cart subtotal to be below configured minimum ${options.configuredMinimum}.`,
					`First subtotal: ${firstSubtotal}`,
					`First product: ${formatProducts([firstProduct])}`,
					`Banner text: ${firstBanner.text || '<none>'}`,
					`Current URL: ${shopPage.page.url()}`,
				].join('\n'),
			)
		}

		assertBlockedMinimumBanner(firstBanner, options.configuredMinimum, firstSubtotal)

		for (let iteration = 1; iteration <= maxAddIterations; iteration += 1) {
			const latestSubtotal = subtotalProgression[subtotalProgression.length - 1]

			if (latestSubtotal > options.configuredMinimum) {
				break
			}

			await shopPage.openStorefrontForFulfillment(options.fulfillment)
			const candidates = await shopPage.getAddableStorefrontProducts(usage)
			const nextProduct = candidates.find(candidate => {
				return !addedProducts.some(addedProduct => {
					if (candidate.sku && addedProduct.sku) {
						return candidate.sku === addedProduct.sku
					}

					return candidate.menuIndex === addedProduct.menuIndex
				})
			})

			if (!nextProduct) {
				throw new Error(
					[
						`Unable to cross configured minimum ${options.configuredMinimum}; no unused addable storefront products remain.`,
						`Subtotal progression: ${subtotalProgression.join(' -> ')}`,
						`Added products:\n${formatProducts(addedProducts)}`,
						`Last banner text: ${bannerTexts[bannerTexts.length - 1] || '<none>'}`,
					].join('\n'),
				)
			}

			await shopPage.addStorefrontProduct(nextProduct, usage)
			addedProducts.push(nextProduct)
			await shopPage.goToCart({ requireItems: true })

			const subtotal = await shopPage.getCartSubtotalAmount()
			subtotalProgression.push(subtotal)

			const banner = await shopPage.getMinimumOrderBannerState()
			recordBanner(banner, bannerTexts, remainingAmounts)

			if (subtotal <= options.configuredMinimum) {
				assertBlockedMinimumBanner(banner, options.configuredMinimum, subtotal)
			}
		}

		const finalSubtotal = subtotalProgression[subtotalProgression.length - 1]

		if (finalSubtotal <= options.configuredMinimum) {
			throw new Error(
				[
					`Unable to exceed configured minimum ${options.configuredMinimum} within ${maxAddIterations} add iterations.`,
					`Subtotal progression: ${subtotalProgression.join(' -> ')}`,
					`Added products:\n${formatProducts(addedProducts)}`,
					`Last banner text: ${bannerTexts[bannerTexts.length - 1] || '<none>'}`,
				].join('\n'),
			)
		}

		const finalBanner = await shopPage.getMinimumOrderBannerState()
		recordBanner(finalBanner, bannerTexts, remainingAmounts)

		if (finalBanner.isVisible) {
			throw new Error(
				[
					'Minimum-order banner is still visible after cart subtotal crossed the configured minimum.',
					`Configured minimum: ${options.configuredMinimum}`,
					`Final subtotal: ${finalSubtotal}`,
					`Final banner text: ${finalBanner.text || '<none>'}`,
					`Subtotal progression: ${subtotalProgression.join(' -> ')}`,
				].join('\n'),
			)
		}

		const checkoutState = await shopPage.getStorefrontCheckoutState()

		if (!checkoutState.isReachable) {
			throw new Error(
				[
					'Checkout was not visible and enabled after cart subtotal crossed the configured minimum.',
					`Configured minimum: ${options.configuredMinimum}`,
					`Final subtotal: ${finalSubtotal}`,
					`Checkout state: ${JSON.stringify(checkoutState)}`,
					`Subtotal progression: ${subtotalProgression.join(' -> ')}`,
				].join('\n'),
			)
		}

		return {
			fulfillment: options.fulfillment,
			configuredMinimum: options.configuredMinimum,
			subtotalProgression,
			bannerTexts,
			remainingAmounts,
			addedProducts,
			checkoutState,
			finalUrl: shopPage.page.url(),
		}
	})
}
