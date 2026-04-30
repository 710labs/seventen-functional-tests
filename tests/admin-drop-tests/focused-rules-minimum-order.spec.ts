import { expect, test } from '@playwright/test'
import type { Browser, TestInfo } from '@playwright/test'
import { SvntnCoreSettingsPage } from '../../models/admin/svntn-core-settings-page'
import type { PurchaseLimits } from '../../models/admin/svntn-core-settings-page'
import {
	FocusedRulesStorefrontPage,
	type FocusedRulesFulfillment,
} from '../../models/admin-drop/focused-rules-storefront-page'
import { focusedRulesFixture } from '../../utils/admin-drop/focused-rules-fixture'
import { resetCatalogWithFocusedRulesFixture } from '../../utils/admin-drop/import-focused-rules-fixture'

type MinimumOrderDiagnostics = {
	fulfillment: FocusedRulesFulfillment
	configuredMinimum: number
	productPrice: number
	observations: Array<{
		phase: string
		quantity: number
		targetQuantity?: number
		cartSubtotal: number
		estimatedTotal?: number
		checkoutDisabled?: boolean
		checkoutEnabled?: boolean
		minimumBlockVisible?: boolean
		notices?: string
		url?: string
	}>
	unlockAttempt?: {
		url: string
		notices: string
		checkoutDisabled: boolean
		checkoutEnabled: boolean
		reachedCheckoutOrAccount: boolean
		stillBlocked: boolean
	}
}

const maxMinimumOrderAddIterations = 10

test('Focused rules minimum order is enforced for pickup and delivery @admin-drop @rules @minorder', async ({
	page,
	browser,
}, testInfo) => {
	const { pickupMinimum, deliveryMinimum } = focusedRulesFixture
	const settingsPage = new SvntnCoreSettingsPage(page)
	const cleanupErrors: string[] = []
	let originalPurchaseLimits: PurchaseLimits | undefined
	let mainError: unknown

	try {
		await resetCatalogWithFocusedRulesFixture(page, testInfo)

		await settingsPage.goto()
		originalPurchaseLimits = await settingsPage.getPurchaseLimits()
		await testInfo.attach('minimum-order-original-settings', {
			body: JSON.stringify(originalPurchaseLimits, null, 2),
			contentType: 'application/json',
		})

		await settingsPage.setAndSavePurchaseLimits({
			pickupMinimum: `${pickupMinimum}`,
			deliveryMinimum: `${deliveryMinimum}`,
		})
		await settingsPage.goto()
		const persistedPurchaseLimits = await settingsPage.getPurchaseLimits()
		await testInfo.attach('minimum-order-persisted-settings', {
			body: JSON.stringify(persistedPurchaseLimits, null, 2),
			contentType: 'application/json',
		})
		expect(persistedPurchaseLimits.pickupMinimum).toBe(`${pickupMinimum}`)
		expect(persistedPurchaseLimits.deliveryMinimum).toBe(`${deliveryMinimum}`)

		await validateMinimumOrderForFulfillment(browser, testInfo, 'Pickup', pickupMinimum)
		await validateMinimumOrderForFulfillment(browser, testInfo, 'Delivery', deliveryMinimum)
	} catch (error) {
		mainError = error
	} finally {
		if (originalPurchaseLimits) {
			try {
				await settingsPage.goto()
				await settingsPage.setAndSavePurchaseLimits(originalPurchaseLimits)
				await settingsPage.goto()
				expect(await settingsPage.getPurchaseLimits()).toEqual(originalPurchaseLimits)
			} catch (cleanupError) {
				cleanupErrors.push(`${cleanupError}`)
			}
		}
	}

	expect(cleanupErrors, cleanupErrors.join('\n')).toEqual([])

	if (mainError) {
		throw mainError
	}
})

async function validateMinimumOrderForFulfillment(
	browser: Browser,
	testInfo: TestInfo,
	fulfillment: FocusedRulesFulfillment,
	configuredMinimum: number,
) {
	const { minimumOrderProduct } = focusedRulesFixture
	const storefrontContext = await browser.newContext({
		baseURL: process.env.BASE_URL,
	})
	const storefrontPage = await storefrontContext.newPage()
	const storefront = new FocusedRulesStorefrontPage(storefrontPage)
	const diagnostics: MinimumOrderDiagnostics = {
		fulfillment,
		configuredMinimum,
		productPrice: minimumOrderProduct.price,
		observations: [],
	}

	try {
		await storefront.clearCart()
		await storefront.addProductBySku(minimumOrderProduct.sku, 1, fulfillment)
		await storefront.goToCart()

		let quantity = await storefront.getCartQuantity(minimumOrderProduct.name)
		let cartSubtotal = await storefront.getCartSubtotalAmount()
		let estimatedTotal = await storefront.getCartTotalAmount().catch(() => undefined)
		const belowThresholdAttempt = await storefront.attemptCheckout()
		const belowThresholdText = `${belowThresholdAttempt.notices}\n${belowThresholdAttempt.bodyText}`
		const belowThresholdPath = new URL(belowThresholdAttempt.url).pathname
		const reachedCheckoutBelowMinimum =
			/\/checkout\/?$/.test(belowThresholdPath) || /\/my-account\/?$/.test(belowThresholdPath)

		diagnostics.observations.push({
			phase: 'below-threshold-checkout-attempt',
			quantity,
			cartSubtotal,
			estimatedTotal,
			checkoutDisabled: belowThresholdAttempt.checkoutDisabled,
			checkoutEnabled: belowThresholdAttempt.checkoutEnabled,
			notices: belowThresholdAttempt.notices,
			url: belowThresholdAttempt.url,
		})

		expect(
			cartSubtotal,
			`Expected first ${fulfillment} cart subtotal to be below configured minimum ${configuredMinimum}`,
		).toBeLessThan(configuredMinimum)
		expect(
			storefront.hasMinimumOrderBlockText(belowThresholdText),
			`Expected below-threshold ${fulfillment} cart to show an order-minimum-not-met block`,
		).toBe(true)
		expect(
			reachedCheckoutBelowMinimum,
			`Expected below-threshold ${fulfillment} cart to remain blocked before checkout`,
		).toBe(false)

		await storefront.goToCart()

		for (
			let iteration = 0;
			cartSubtotal <= configuredMinimum && iteration < maxMinimumOrderAddIterations;
			iteration += 1
		) {
			const targetQuantity = quantity + 1
			await storefront.setCartQuantity(minimumOrderProduct.name, targetQuantity)
			await storefront.goToCart()
			quantity = await storefront.getCartQuantity(minimumOrderProduct.name)
			cartSubtotal = await storefront.getCartSubtotalAmount()
			estimatedTotal = await storefront.getCartTotalAmount().catch(() => undefined)
			const cartTextAfterQuantityUpdate = `${await storefront.getNoticeText()}\n${await storefront.getBodyText()}`
			const minimumBlockVisible = storefront.hasMinimumOrderBlockText(cartTextAfterQuantityUpdate)

			expect(
				quantity,
				`Expected ${fulfillment} cart quantity to update through the cart quantity input`,
			).toBe(targetQuantity)

			diagnostics.observations.push({
				phase: `cart-quantity-update-${iteration + 1}`,
				quantity,
				targetQuantity,
				cartSubtotal,
				estimatedTotal,
				minimumBlockVisible,
				notices: await storefront.getNoticeText(),
			})
		}

		expect(
			cartSubtotal,
			`Expected ${fulfillment} cart subtotal to meet configured minimum ${configuredMinimum} after cart quantity updates`,
		).toBeGreaterThanOrEqual(configuredMinimum)

		const aboveThresholdCartText = `${await storefront.getNoticeText()}\n${await storefront.getBodyText()}`
		const stillBlockedOnCart = storefront.hasMinimumOrderBlockText(aboveThresholdCartText)
		diagnostics.observations.push({
			phase: 'above-threshold-cart-state',
			quantity,
			cartSubtotal,
			estimatedTotal,
			minimumBlockVisible: stillBlockedOnCart,
			notices: await storefront.getNoticeText(),
		})

		expect(
			stillBlockedOnCart,
			`Expected above-threshold ${fulfillment} cart to clear the minimum-order banner before checkout`,
		).toBe(false)

		const unlockAttempt = await storefront.attemptCheckout()
		const unlockAttemptText = `${unlockAttempt.notices}\n${unlockAttempt.bodyText}`
		const unlockAttemptPath = new URL(unlockAttempt.url).pathname
		const stillBlocked = storefront.hasMinimumOrderBlockText(unlockAttemptText)
		const reachedCheckoutOrAccount =
			/\/checkout\/?$/.test(unlockAttemptPath) ||
			/\/my-account\/?$/.test(unlockAttemptPath) ||
			/complete your account/i.test(unlockAttempt.bodyText)

		diagnostics.unlockAttempt = {
			url: unlockAttempt.url,
			notices: unlockAttempt.notices,
			checkoutDisabled: unlockAttempt.checkoutDisabled,
			checkoutEnabled: unlockAttempt.checkoutEnabled,
			reachedCheckoutOrAccount,
			stillBlocked,
		}

		expect(stillBlocked, `Expected above-threshold ${fulfillment} cart to clear the minimum-order block`).toBe(
			false,
		)
		expect(
			unlockAttempt.checkoutDisabled,
			`Expected above-threshold ${fulfillment} checkout control to be enabled`,
		).toBe(false)
		expect(
			reachedCheckoutOrAccount,
			`Expected above-threshold ${fulfillment} cart to proceed past the cart minimum check`,
		).toBe(true)
	} finally {
		await testInfo.attach(`minimum-order-${fulfillment.toLowerCase()}-diagnostics`, {
			body: JSON.stringify(diagnostics, null, 2),
			contentType: 'application/json',
		})
		await storefrontContext.close()
	}
}
