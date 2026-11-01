import { randomUUID } from 'node:crypto'
import { test, expect } from '../../options'
import { AgeGatePage } from '../../models/age-gate-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { LoginPage } from '../../models/login-page'
import { MyAccountPage } from '../../models/my-account-page'
import { ShopPage, type CategoryProductCandidate } from '../../models/shop-page'
import { CartPage } from '../../models/cart-page'
import { CheckoutPage } from '../../models/checkout-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'

const rules = require('../../support/bulk-discounts/rules.json')
const { expectedCart } = require('../../support/bulk-discounts/oracle.cjs')
const { resolvePlan, goldenPlans } = require('../../support/bulk-discounts/scenarios.cjs')
const { assertDevBaseUrl, assertDevUrl } = require('../../support/bulk-discounts/dev-only.cjs')

type CartLine = {
	productId: number; categoryIds: number[]; qty: number; unitPrice: string; isFreeBogoUnit: boolean
}

test.describe('Bulk discounts', { tag: ['@CA', '@bulk'] }, () => {
	// Retrying an order test could create a second order after a confirmation failure.
	test.describe.configure({ retries: 0 })
	let shop: ShopPage
	let cart: CartPage
	let checkout: CheckoutPage
	let account: MyAccountPage
	let login: LoginPage
	let createAccount: CreateAccountPage
	let orderReceived: OrderReceivedPage
	let signedIn = false
	let cartTouched = false
	let cleanupUser: { email: string; password: string } | undefined

	test.beforeEach(async ({ page, baseURL, browserName, qaClient }, testInfo) => {
		signedIn = false
		cartTouched = false
		cleanupUser = undefined
		// Ordinary prod/stage suites still discover this file but cannot execute it.
		test.skip(testInfo.config.metadata.bulkDiscounts !== true, 'Bulk rules are enabled only in the existing dev configuration')
		assertDevBaseUrl(baseURL)
		await page.context().route('**/*', async route => {
			const request = route.request()
			if (request.isNavigationRequest() && request.frame().parentFrame() === null) {
				try { assertDevUrl(request.url()) } catch { await route.abort('blockedbyclient'); return }
			}
			await route.continue()
		})
		shop = new ShopPage(page, browserName, testInfo)
		cart = new CartPage(page, qaClient, browserName, testInfo, 'recreational')
		checkout = new CheckoutPage(page, qaClient)
		account = new MyAccountPage(page)
		login = new LoginPage(page)
		createAccount = new CreateAccountPage(page, qaClient)
		orderReceived = new OrderReceivedPage(page)
	})

	test.afterEach(async () => {
		if (cartTouched) {
			if (!signedIn) {
				if (!cleanupUser) throw new Error('Cannot clean cart without the test account session')
				await login.login(cleanupUser.email, cleanupUser.password)
			}
			await shop.clearStorefrontCart()
			await cart.verifyEmpty()
		}
	})

	async function signIn(page, credentials?: { email: string; password: string }) {
		await new AgeGatePage(page).passAgeGate()
		await new ListPasswordPage(page).submitPassword(process.env.CHECKOUT_PASSWORD || '')
		// Same generated account/QAClient path as the existing CA E2E tests.
		const user = credentials || await createAccount.createApi('recreational', 'current')
		cleanupUser = user
		await login.login(user.email, user.password)
		signedIn = true
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') await account.addAddress()
		return user
	}

	async function catalogue(): Promise<CategoryProductCandidate[]> {
		await shop.openStorefrontForFulfillment('Pickup')
		const products = await shop.getCategoryProducts(rules.bulkRules.map(rule => rule.categoryId))
		for (const product of products) {
			expect(rules.bulkRules.filter(rule => product.categoryIds.includes(rule.categoryId)),
				`Product ${product.productId} must not belong to multiple bulk categories`).toHaveLength(1)
		}
		return products
	}

	async function buildCart(lines: CartLine[], products: CategoryProductCandidate[]) {
		cartTouched = true
		const selected = lines.map(line => {
			const product = products.find(product => product.productId === line.productId)
			if (!product) throw new Error(`Required product ${line.productId} is unavailable`)
			return product
		})
		for (const product of selected) {
			const rule = rules.bulkRules.find(rule => product.categoryIds.includes(rule.categoryId))
			if (rule) await shop.verifyProductPricingOffers(product, rule.tiers)
		}
		await shop.addSelectedProducts(selected)
		for (const line of lines) if (line.qty !== 1) await cart.setProductQuantity(line.productId, line.qty)
	}

	async function verifyCart(lines: CartLine[], user = 'plain') {
		const expected = expectedCart(lines, user)
		await cart.verifyProductQuantities(lines)
		await cart.verifyProductDiscountTags(lines, expected.discountLines)
		await cart.verifyDiscountPricing(expected)
	}

	for (const rule of rules.bulkRules) {
		test(`${rule.categoryName}: 2 → 3 → 4 → 5 → 6 → 4 → 5 units`, async ({ page }) => {
			await signIn(page)
			const products = await catalogue()
			const product = products.find(product => product.categoryIds.includes(rule.categoryId) && product.productId !== rules.bogo.productId)
			expect(product, `Need an addable product in category ${rule.categoryId}`).toBeTruthy()
			const line: CartLine = { productId: product.productId, categoryIds: product.categoryIds, unitPrice: product.unitPrice, qty: 2, isFreeBogoUnit: false }
			await buildCart([line], products)
			for (const quantity of [2, 3, 4, 5, 6, 4, 5]) {
				await test.step(`Verify ${quantity} paid units`, async () => {
					if (quantity !== line.qty) await cart.setProductQuantity(product.productId, quantity)
					line.qty = quantity
					await verifyCart([line])
				})
			}
		})
	}

	test('J1: cross-SKU tiers, removal and re-addition through checkout', async ({ page }) => {
		await signIn(page)
		const products = await catalogue()
		const lines: CartLine[] = resolvePlan(goldenPlans.find(plan => plan.id === 'J1'), products).requests
		await buildCart(lines, products)
		await verifyCart(lines)
		const secondEighth = lines[1]
		for (const quantity of [3, 1]) {
			await cart.setProductQuantity(secondEighth.productId, quantity)
			secondEighth.qty = quantity
			await verifyCart(lines)
		}
		await cart.removeProduct(secondEighth.productId)
		await verifyCart(lines.filter(line => line !== secondEighth))
		await shop.openStorefrontForFulfillment('Pickup')
		await shop.addSelectedProducts([products.find(product => product.productId === secondEighth.productId)!])
		await verifyCart(lines)
		await cart.goToCheckout()
		await checkout.verifyDiscountPricing(expectedCart(lines))
	})

	test('J2: all five bulk rules and mixed prices survive order placement', async ({ page }, testInfo) => {
		await signIn(page)
		const products = await catalogue()
		const lines: CartLine[] = resolvePlan(goldenPlans.find(plan => plan.id === 'J2'), products).requests
		await buildCart(lines, products)
		await verifyCart(lines)
		const expected = expectedCart(lines)
		await cart.goToCheckout()
		await checkout.submitDiscountOrder(expected, `bulk-regression:J2:${testInfo.project.name}:${randomUUID()}`)
		await orderReceived.verifyDiscountedTotal(expected)
	})

	test('J5: existing user retains bulk discounts after logout/login', async ({ page }, testInfo) => {
		const user = await signIn(page)
		const products = await catalogue()
		const lines: CartLine[] = resolvePlan(goldenPlans.find(plan => plan.id === 'J5'), products).requests
		await buildCart(lines, products)
		await verifyCart(lines)
		await account.logout()
		signedIn = false
		await login.login(user.email, user.password)
		signedIn = true
		await shop.goToCart({ requireItems: true })
		await verifyCart(lines)
		const expected = expectedCart(lines)
		await cart.goToCheckout()
		await checkout.submitDiscountOrder(expected, `bulk-regression:J5-existing:${testInfo.project.name}:${randomUUID()}`)
		await orderReceived.verifyDiscountedTotal(expected)
	})

	test('J5: freshly registered user receives bulk pricing on their first order', async ({ page }, testInfo) => {
		await new AgeGatePage(page).passAgeGate()
		await new ListPasswordPage(page).submitPassword(process.env.CHECKOUT_PASSWORD || '')
		await createAccount.create('Bulk', 'Regression', `test+bulk-${randomUUID()}@710labs-test.com`,
			'test1234', '90210', 'recreational', false, '440 N Rodeo Dr, Beverly Hills, CA 90210', 'CA')
		signedIn = true
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') await account.addAddress()
		const products = await catalogue()
		const lines: CartLine[] = resolvePlan(goldenPlans.find(plan => plan.id === 'J5'), products).requests
		await buildCart(lines, products)
		await verifyCart(lines)
		const expected = expectedCart(lines)
		await cart.goToCheckout()
		await checkout.submitDiscountOrder(expected, `bulk-regression:J5-new:${testInfo.project.name}:${randomUUID()}`)
		await orderReceived.verifyDiscountedTotal(expected)
	})
})
