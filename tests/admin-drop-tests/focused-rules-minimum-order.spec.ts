import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '../../options'
import { AgeGatePage } from '../../models/age-gate-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { MyAccountPage } from '../../models/my-account-page'
import { CartPage } from '../../models/cart-page'
import { CheckoutPage } from '../../models/checkout-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'
import { AdminLogin } from '../../models/admin/admin-login-page'
import {
	SvntnCoreSettingsPage,
	type MinimumOrderSettings,
} from '../../models/admin/svntn-core-settings-page'
import { ShopPage } from '../../models/shop-page'

function randomMinimumExcludingCurrent(originalSettings?: MinimumOrderSettings) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		const minimum = Math.floor(Math.random() * 151) + 150

		if (
			!originalSettings ||
			(minimum !== originalSettings.pickupMinimum && minimum !== originalSettings.deliveryMinimum)
		) {
			return minimum
		}
	}

	return Math.floor(Math.random() * 151) + 150
}

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
	await testInfo.attach(name, {
		body: JSON.stringify(body, null, 2),
		contentType: 'application/json',
	})
}

function buildStorefrontCustomer(testInfo: TestInfo) {
	const uniqueId = `${Date.now()}-${testInfo.workerIndex}`

	return {
		address: '440 N Rodeo Dr, Beverly Hills, CA 90210',
		email: `admin-drop-minorder-${uniqueId}@test710labstest.com`,
		firstName: `MinOrder${testInfo.workerIndex}`,
		lastName: `Smoke${Date.now()}`,
		password: 'test1234',
		zipCode: '90210',
	}
}

async function assertPublishedProductsExist(page: Page, testInfo: TestInfo) {
	await test.step('Verify uploaded menu exists in admin', async () => {
		await page.goto('/wp-admin/edit.php?post_status=publish&post_type=product&paged=1')
		await expect(page).toHaveURL(/post_type=product/)

		const productRows = page.locator('#the-list tr[id^="post-"]')
		const productCount = await productRows.count()
		const emptyStateVisible = await page
			.locator('#the-list .no-items')
			.first()
			.isVisible()
			.catch(() => false)

		await attachJson(testInfo, 'minimum-order-admin-product-preflight', {
			productCount,
			emptyStateVisible,
			url: page.url(),
		})

		if (productCount === 0 || emptyStateVisible) {
			throw new Error(
				[
					'Minimum-order smoke requires a previously uploaded menu before admin minimums are changed.',
					'Run the menu-upload smoke first, then run @minorder.',
					`Published product rows found: ${productCount}`,
					`Empty state visible: ${emptyStateVisible}`,
					`Current URL: ${page.url()}`,
				].join('\n'),
			)
		}
	})
}

async function passStorefrontGates(page: Page) {
	await test.step('Pass storefront gates', async () => {
		expect(process.env.CHECKOUT_PASSWORD, 'CHECKOUT_PASSWORD is required for storefront unlock').toBeTruthy()

		const ageGatePage = new AgeGatePage(page)
		const listPasswordPage = new ListPasswordPage(page)

		await ageGatePage.passAgeGate()
		await listPasswordPage.submitPassword(process.env.CHECKOUT_PASSWORD || '')
		await expect(
			page.locator('input[name="post_password"]').first(),
			'Expected private-store password gate to close after submitting CHECKOUT_PASSWORD',
		).toBeHidden({ timeout: 10000 })
	})
}

test('Focused rules minimum order is enforced @admin-drop @rules @minorder', async ({
	page,
	browser,
	browserName,
	qaClient,
}, testInfo) => {
	const settingsPage = new SvntnCoreSettingsPage(page)
	let originalSettings: MinimumOrderSettings | undefined
	let generatedSettings: MinimumOrderSettings | undefined
	let persistedSettings: MinimumOrderSettings | undefined
	let restoredSettings: MinimumOrderSettings | undefined

	await assertPublishedProductsExist(page, testInfo)
	await settingsPage.goto()
	originalSettings = await settingsPage.getMinimumOrderSettings()
	const generatedMinimum = randomMinimumExcludingCurrent(originalSettings)
	generatedSettings = {
		pickupMinimum: generatedMinimum,
		deliveryMinimum: generatedMinimum,
	}

	await attachJson(testInfo, 'minimum-order-generated-settings', {
		generatedMinimum,
		originalSettings,
		generatedSettings,
	})

	await settingsPage.setAndSaveMinimumOrderSettings(generatedSettings)
	persistedSettings = await settingsPage.assertMinimumOrderSettings(generatedSettings)
	await attachJson(testInfo, 'minimum-order-persisted-settings', persistedSettings)

	const adminLoginPage = new AdminLogin(page)
	await adminLoginPage.logout()

	await test.step('Run storefront delivery checkout flow', async () => {
		const storefrontContext = await browser.newContext({
			baseURL: process.env.BASE_URL,
		})
		const storefrontPage = await storefrontContext.newPage()
		const shopPage = new ShopPage(storefrontPage, browserName, testInfo)
		const cartPage = new CartPage(storefrontPage, qaClient, browserName, testInfo, 'recreational')
		const checkoutPage = new CheckoutPage(storefrontPage, qaClient)
		const orderReceivedPage = new OrderReceivedPage(storefrontPage)
		const createAccountPage = new CreateAccountPage(storefrontPage, qaClient)
		const myAccountPage = new MyAccountPage(storefrontPage)
		const storefrontCustomer = buildStorefrontCustomer(testInfo)
		const mobile = testInfo.project.name === 'Mobile Chrome'

		await passStorefrontGates(storefrontPage)
		await createAccountPage.create(
			storefrontCustomer.firstName,
			storefrontCustomer.lastName,
			storefrontCustomer.email,
			storefrontCustomer.password,
			storefrontCustomer.zipCode,
			'recreational',
			false,
			storefrontCustomer.address,
			'CA',
		)
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
			await myAccountPage.addAddress()
		}

		const cartBuildAttempts: Array<{
			attempt: number
			cartSubtotal: number
			checkoutState: Awaited<ReturnType<ShopPage['getStorefrontCheckoutState']>>
			minimumOrderBanner: Awaited<ReturnType<ShopPage['getMinimumOrderBannerState']>>
			productsRequested: number
		}> = []
		let cartSubtotal = 0
		let minimumOrderBanner: Awaited<ReturnType<ShopPage['getMinimumOrderBannerState']>> | undefined
		let checkoutState: Awaited<ReturnType<ShopPage['getStorefrontCheckoutState']>> | undefined

		for (let attempt = 1; attempt <= 4; attempt += 1) {
			const productsRequested = attempt * 6
			await shopPage.addProductsToCart(productsRequested, mobile, 'Delivery', 'recreational')

			cartSubtotal = await shopPage.getCartSubtotalAmount()
			minimumOrderBanner = await shopPage.getMinimumOrderBannerState()
			checkoutState = await shopPage.getStorefrontCheckoutState()
			cartBuildAttempts.push({
				attempt,
				cartSubtotal,
				checkoutState,
				minimumOrderBanner,
				productsRequested,
			})

			if (cartSubtotal > generatedMinimum) {
				break
			}
		}

		await attachJson(testInfo, 'minimum-order-cart-build-summary', {
			attempts: cartBuildAttempts,
			cartSubtotal,
			checkoutState,
			configuredMinimum: generatedMinimum,
			minimumOrderBanner,
			productsRequested:
				cartBuildAttempts[cartBuildAttempts.length - 1]?.productsRequested || 0,
		})
		expect(
			cartSubtotal,
			`Expected cart subtotal ${cartSubtotal} to be greater than generated minimum ${generatedMinimum}`,
		).toBeGreaterThan(generatedMinimum)
		expect(
			minimumOrderBanner?.isVisible,
			'Expected no minimum-order banner after adding products with the standard e2e flow',
		).toBe(false)
		expect(checkoutState?.isReachable, 'Expected checkout to be enabled/reachable').toBe(true)
		await cartPage.goToCheckout()
		await checkoutPage.selectSlot()
		await expect(checkoutPage.placeOrderButton).toBeVisible()
		await expect(checkoutPage.placeOrderButton).toBeEnabled()
		await checkoutPage.placeOrderButton.click()
		const orderNumber = await orderReceivedPage.getOrderNumber()
		await expect(storefrontPage).toHaveURL(/order-received/)
		expect(orderNumber, 'Expected minimum-order smoke to place an order').toBeTruthy()
		await attachJson(testInfo, 'minimum-order-created-order', {
			orderNumber,
			userEmail: storefrontCustomer.email,
			url: storefrontPage.url(),
		})

		await storefrontContext.close()
	})

	await adminLoginPage.login()
	await settingsPage.goto()
	await settingsPage.setAndSaveMinimumOrderSettings(originalSettings)
	restoredSettings = await settingsPage.assertMinimumOrderSettings(originalSettings)
	await attachJson(testInfo, 'minimum-order-restored-settings', {
		originalSettings,
		restoredSettings,
	})

	await attachJson(testInfo, 'minimum-order-admin-settings-summary', {
		generatedSettings,
		originalSettings,
		persistedSettings,
		restoredSettings,
	})
})
