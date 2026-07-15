import { expect, Page, test } from '@playwright/test'
import { appendFileSync } from 'fs'
import { LiveNonProdAccountPage } from '../../models/always-on/live-nonprod-account-page.ts'
import { LiveNonProdCartFlow } from '../../models/always-on/live-nonprod-cart-flow.ts'
import { LiveNonProdCheckoutPage } from '../../models/always-on/live-nonprod-checkout-page.ts'
import { LiveNonProdHomePageActions } from '../../models/always-on/live-nonprod-homepage-actions.ts'
import { HomePageLogin } from '../../models/always-on/login-homepage.ts'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation.ts'

require('dotenv').config({ path: '.env' })

type LiveUserType = 'rec' | 'med'

const authenticationAddress = '440 Rodeo Drive Beverly Hills'
const checkoutAddress = '440 N Rodeo Dr, Beverly Hills, CA 90210'
const recreationalCheckoutAddress = '2919 S La Cienega Blvd, Culver City, CA'
const medicalCheckoutAddress = '2919 S La Cienega Blvd, Culver City, CA 90232'

test.describe('Live Tests', () => {
	test.setTimeout(500000)
	test.describe.configure({ mode: 'parallel' })

	const liveURL = process.env.ALWAYS_ON_URL || ''
	const alwaysOnPassword = process.env.ALWAYS_ON_PASSWORD || ''
	const newAlwaysOnPassword = process.env.NEW_ALWAYS_ON_PASSWORD || ''

	console.log(`------- \n URL being tested: ${liveURL} -------- \n `)

	async function registerLiveUser(
		page: Page,
		userType: LiveUserType,
		flowType: 'order' | 'account',
	) {
		const homePageLogin = new HomePageLogin(page)
		const homePageActions = new LiveNonProdHomePageActions(page)
		const registrationKey = `${userType}_${flowType}_${Math.random().toString(36).slice(2, 10)}`

		await homePageLogin.navigateToURL(page, liveURL)
		await homePageActions.enterAddress(page, 'live', authenticationAddress)
		await homePageLogin.newTestverifyUserSignInModalAppears(page, liveURL)
		await homePageActions.addSingleProductToCart(page)
		await homePageLogin.registerNewUser(page, registrationKey)
		await homePageActions.goToMainStorePage(page)
		await homePageLogin.liveVerifyShopLoadsAfterSignIn(page)

		return { homePageActions, homePageLogin }
	}

	async function completeOrderFlow(page: Page, userType: LiveUserType) {
		await registerLiveUser(page, userType, 'order')

		const cartFlow = new LiveNonProdCartFlow(page)
		const checkoutPage = new LiveNonProdCheckoutPage(page)
		const orderConfirmation = new OrderConfirmationPage(page)

		await cartFlow.addProductsUntilCheckout(userType)
		await checkoutPage.verifyCheckoutPageLoads(page)

		if (userType === 'med') {
			await checkoutPage.completeMedCheckout(
				page,
				checkoutAddress,
				medicalCheckoutAddress,
			)
		} else {
			await checkoutPage.completeRecCheckout(
				page,
				checkoutAddress,
				recreationalCheckoutAddress,
			)
		}

		await checkoutPage.placeOrder(page)
		await orderConfirmation.verifyOrderConfirmationPageLoads(page)

		const orderNumber = await orderConfirmation.getOrderNumber()
		await expect(orderNumber, 'Failed to create order').not.toBeNull()
		appendFileSync('order_ids.txt', `${orderNumber}\n`, { encoding: 'utf-8' })
		console.log(`✅ Appended order_ids.txt → ${orderNumber}`)
	}

	async function completeAccountFlow(page: Page, userType: LiveUserType) {
		const { homePageActions, homePageLogin } = await registerLiveUser(
			page,
			userType,
			'account',
		)
		const accountPage = new LiveNonProdAccountPage(page)

		await accountPage.goToAccountPage()
		const newEmail = await accountPage.verifyAccountPageElements(
			userType,
			true,
			alwaysOnPassword,
			newAlwaysOnPassword,
		)

		await accountPage.logOut(page)
		await homePageLogin.navigateToURL(page, liveURL)
		await homePageActions.enterAddress(page, 'live', authenticationAddress)
		await homePageActions.addSingleProductToCart(page)
		await homePageLogin.loginExistingUser(
			page,
			alwaysOnPassword,
			newEmail,
			newAlwaysOnPassword,
		)
	}

	test(
		'Rec Order Flow - Register, Checkout, and Capture Order',
		{ tag: ['@recreational', '@order'] },
		async ({ page }) => completeOrderFlow(page, 'rec'),
	)

	test(
		'Rec Account Flow - Register, Update Account, and Re-Log In',
		{ tag: ['@recreational', '@account'] },
		async ({ page }) => completeAccountFlow(page, 'rec'),
	)

	test(
		'MED Order Flow - Register, Checkout Medical Products, and Capture Order',
		{ tag: ['@medical', '@order'] },
		async ({ page }) => completeOrderFlow(page, 'med'),
	)

	test(
		'MED Account Flow - Register, Update Account, and Re-Log In',
		{ tag: ['@medical', '@account'] },
		async ({ page }) => completeAccountFlow(page, 'med'),
	)
})
