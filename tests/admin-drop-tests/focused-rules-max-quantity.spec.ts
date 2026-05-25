import type { BrowserContext, Page, TestInfo } from '@playwright/test'
import { expect, test } from '../../options'
import { AgeGatePage } from '../../models/age-gate-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { MyAccountPage } from '../../models/my-account-page'
import { AdminProductsPage } from '../../models/admin/admin-products-page'
import { FocusedRulesStorefrontPage } from '../../models/admin-drop/focused-rules-storefront-page'
import { focusedRulesFixture } from '../../utils/admin-drop/focused-rules-fixture'
import {
	cleanupFocusedRulesCheckoutPassword,
	ensureFocusedRulesCheckoutPassword,
	type FocusedRulesStorefrontPasswordStatus,
} from '../../utils/admin-drop/focused-rules-storefront-password'
import { resetCatalogWithFocusedRulesFixture } from '../../utils/admin-drop/import-focused-rules-fixture'
import { buildStorageStateWithRecaptchaBypass } from '../../support/qa/recaptcha-bypass'

function buildStorefrontCustomer(testInfo: TestInfo) {
	const uniqueId = `${Date.now()}-${testInfo.workerIndex}`

	return {
		address: '440 N Rodeo Dr, Beverly Hills, CA 90210',
		email: `admin-drop-maxqty-${uniqueId}@test710labstest.com`,
		firstName: `MaxQty${testInfo.workerIndex}`,
		lastName: `Smoke${Date.now()}`,
		password: 'test1234',
		zipCode: '90210',
	}
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

test('Focused rules max quantity is enforced @admin-drop @rules @maxqty', async ({
	page,
	browser,
	qaClient,
}, testInfo) => {
	const { maxQuantityProduct } = focusedRulesFixture
	const expectedMaxQuantity = maxQuantityProduct.expectedMaxQuantity || 2
	const adminProductsPage = new AdminProductsPage(page)
	const cleanupErrors: string[] = []
	let checkoutPasswordStatus: FocusedRulesStorefrontPasswordStatus | undefined
	let storefrontContext: BrowserContext | undefined
	let mainError: unknown

	try {
		await resetCatalogWithFocusedRulesFixture(page, testInfo)
		checkoutPasswordStatus = await ensureFocusedRulesCheckoutPassword(page, testInfo)
		await adminProductsPage.openProductEditBySku(maxQuantityProduct.sku)
		const maxQuantityFieldSnapshots = await adminProductsPage.getVisibleMaxQuantityFieldSnapshots()
		await testInfo.attach('max-quantity-admin-field-snapshots', {
			body: JSON.stringify(maxQuantityFieldSnapshots, null, 2),
			contentType: 'application/json',
		})

		if (maxQuantityFieldSnapshots.length) {
			expect(
				maxQuantityFieldSnapshots.some(snapshot => snapshot.value === `${expectedMaxQuantity}`),
				`Expected at least one visible max quantity field to persist value ${expectedMaxQuantity}`,
			).toBe(true)
		}

		storefrontContext = await browser.newContext({
			baseURL: process.env.BASE_URL,
			storageState: buildStorageStateWithRecaptchaBypass(process.env.BASE_URL),
		})
		const storefrontPage = await storefrontContext.newPage()
		const storefront = new FocusedRulesStorefrontPage(storefrontPage, checkoutPasswordStatus.checkoutPassword)
		const createAccountPage = new CreateAccountPage(storefrontPage, qaClient)
		const myAccountPage = new MyAccountPage(storefrontPage)
		const storefrontCustomer = buildStorefrontCustomer(testInfo)

		await passStorefrontGates(storefrontPage)
		await storefrontPage.goto('/my-account/')
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

		await storefront.clearCart()
		await storefront.addProductBySku(maxQuantityProduct.sku, expectedMaxQuantity)
		await storefront.goToCart()

		const allowedQuantity = await storefront.getCartQuantity(maxQuantityProduct.name)
		expect(allowedQuantity, `Expected allowed max quantity ${expectedMaxQuantity} to be accepted`).toBe(
			expectedMaxQuantity,
		)

		await storefront.setCartQuantity(maxQuantityProduct.name, expectedMaxQuantity + 1)
		const enforcedQuantity = await storefront.getCartQuantity(maxQuantityProduct.name)
		const nativeValidation = await storefront.getCartQuantityValidationState(maxQuantityProduct.name)
		const noticeText = await storefront.getNoticeText()
		const bodyText = await storefront.getBodyText()
		const enforcementText = `${noticeText}\n${bodyText}`
		const hasEnforcementMessage =
			/(maximum|max|limit|allowed|quantity|only)/i.test(enforcementText) &&
			enforcementText.includes(`${expectedMaxQuantity}`)
		const hasNativeValidationMessage =
			nativeValidation.max === `${expectedMaxQuantity}` &&
			nativeValidation.rangeOverflow &&
			(nativeValidation.validationMessage
				.toLowerCase()
				.includes(`less than or equal to ${expectedMaxQuantity}`) ||
				nativeValidation.validationMessage.includes(`${expectedMaxQuantity}`))

		await testInfo.attach('max-quantity-storefront-enforcement', {
			body: JSON.stringify(
				{
					expectedMaxQuantity,
					allowedQuantity,
					enforcedQuantity,
					nativeValidation,
					noticeText,
					userEmail: storefrontCustomer.email,
					url: storefrontPage.url(),
				},
				null,
				2,
			),
			contentType: 'application/json',
		})

		expect(
			hasNativeValidationMessage || enforcedQuantity <= expectedMaxQuantity || hasEnforcementMessage,
			`Expected quantity ${expectedMaxQuantity + 1} to trigger native max validation, be corrected, or show a max quantity notice`,
		).toBe(true)
	} catch (error) {
		mainError = error
	} finally {
		if (storefrontContext) {
			await storefrontContext.close()
		}

		try {
			await cleanupFocusedRulesCheckoutPassword(page, checkoutPasswordStatus)
		} catch (cleanupError) {
			cleanupErrors.push(`${cleanupError}`)
		}
	}

	expect(cleanupErrors, cleanupErrors.join('\n')).toEqual([])

	if (mainError) {
		throw mainError
	}
})
