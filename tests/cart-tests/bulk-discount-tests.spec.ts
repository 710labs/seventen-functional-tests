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
const { expectedCart: calculateExpectedCart } = require('../../support/bulk-discounts/oracle.cjs')
const pickupTaxes = require('../../support/bulk-discounts/dev-pickup-taxes.json')
// Keep workbook reference rates separate from this dev pickup store's rates.
const liveRules = { ...rules, taxes: pickupTaxes.taxes, taxRounding: pickupTaxes.taxRounding }
const { resolvePlan, goldenPlans } = require('../../support/bulk-discounts/scenarios.cjs')
const { assertDevBaseUrl, assertDevUrl } = require('../../support/bulk-discounts/dev-only.cjs')

type CartLine = {
	productId: number; categoryIds: number[]; qty: number; unitPrice: string; isFreeBogoUnit: boolean
}

const expectedCart = (lines: CartLine[], user = 'plain') => calculateExpectedCart(lines, user, liveRules)

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
	let cleanupUser: { email: string; password: string; firstName: string; lastName: string; orderNote: string } | undefined

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
		await new AgeGatePage(page).passAgeGate()
		await new ListPasswordPage(page).submitPassword(process.env.CHECKOUT_PASSWORD || '')
		const caseName = testInfo.annotations.find(annotation => annotation.type === 'bulk-case')?.description
		if (!caseName) throw new Error('Bulk tests must identify their scenario for account and order naming')
		const caseSlug = caseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 12)
		const projectSlug = testInfo.project.name.toLowerCase().slice(0, 1)
		const runId = randomUUID().replace(/-/g, '')
		cleanupUser = {
			firstName: `Bulk ${caseName}`, lastName: testInfo.project.name,
			email: `test+bulk-${caseSlug}-${projectSlug}-${runId.slice(0, 16)}@710labs-test.com`, password: 'test1234',
			orderNote: `bulk-regression:${caseName}:${testInfo.project.name}:${runId}`,
		}
		expect(cleanupUser.email.length, 'WordPress username length limit').toBeLessThanOrEqual(60)
		await createAccount.create(cleanupUser.firstName, cleanupUser.lastName, cleanupUser.email, cleanupUser.password,
			'90210', 'recreational', false, '440 N Rodeo Dr, Beverly Hills, CA 90210', 'CA')
		// Registration leaves this test's new account signed in.
		signedIn = true
		if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') await account.addAddress()
		await shop.goToCart()
		await cart.verifyEmpty()
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
		const selected = lines.map(line => {
			const product = products.find(product => product.productId === line.productId)
			if (!product) throw new Error(`Required product ${line.productId} is unavailable`)
			return product
		})
		cartTouched = true
		await shop.addSelectedProducts(selected, cart)
		for (const line of lines) if (line.qty !== 1) await cart.setProductQuantity(line.productId, line.qty)
	}

	async function verifyCart(lines: CartLine[], user = 'plain') {
		const expected = expectedCart(lines, user)
		await cart.verifyProductQuantities(lines)
		await cart.verifyProductDiscountTags(lines, expected.discountLines)
		await cart.verifyDiscountPricing(expected)
	}

	async function submitScenarioOrder(lines: CartLine[], products: CategoryProductCandidate[]) {
		if (!cleanupUser) throw new Error('Order submission requires this scenario account')
		// Boundary checks are complete. Keep those quantities intact while satisfying
		// the store's minimum with a companion from a different category if necessary.
		const scenarioCategories = new Set(lines.flatMap(line => line.categoryIds))
		let companion: CartLine | undefined
		for (let attempt = 0; attempt < 5; attempt++) {
			const minimum = await shop.getMinimumOrderBannerState()
			if (!minimum.isVisible) break
			if (!minimum.remainingAmount || minimum.remainingAmount <= 0) {
				throw new Error(`Cannot determine the pickup minimum shortfall: ${minimum.text}`)
			}
			if (!companion) {
				const product = [...products].sort((a, b) => Number(b.unitPrice) - Number(a.unitPrice))
					.find(product => product.productId !== rules.bogo.productId &&
						product.categoryIds.every(id => !scenarioCategories.has(id)))
				if (!product) throw new Error('Need a companion product outside the scenario categories to meet the pickup minimum')
				await shop.openStorefrontForFulfillment('Pickup')
				await shop.addSelectedProducts([product], cart)
				companion = { productId: product.productId, categoryIds: product.categoryIds,
					unitPrice: product.unitPrice, qty: 1, isFreeBogoUnit: false }
				lines.push(companion)
			} else {
				companion.qty += Math.max(1, Math.ceil(minimum.remainingAmount / Number(companion.unitPrice)))
				await cart.setProductQuantity(companion.productId, companion.qty)
			}
			await verifyCart(lines)
		}
		expect((await shop.getMinimumOrderBannerState()).isVisible, 'The order must meet the pickup minimum').toBe(false)
		await verifyCart(lines)
		const expected = expectedCart(lines)
		test.info().annotations.push({ type: 'order-reference', description: cleanupUser.orderNote })
		await cart.goToCheckout()
		await checkout.submitDiscountOrder(expected, cleanupUser.orderNote)
		const orderNumber = await orderReceived.verifyDiscountedTotal(expected)
		test.info().annotations.push({ type: 'order', description: String(orderNumber) })
	}

	for (const rule of rules.bulkRules) {
		test(`${rule.categoryName}: 2 → 3 → 4 → 5 → 6 → 4 → 5 units and order placement`,
			{ annotation: { type: 'bulk-case', description: `${rule.categoryName} Tiers` } }, async () => {
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
			await submitScenarioOrder([line], products)
		})
	}

	test('J1: cross-SKU tiers, removal and re-addition through order placement',
		{ annotation: { type: 'bulk-case', description: 'J1 Cross SKU' } }, async () => {
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
		await shop.addSelectedProducts([products.find(product => product.productId === secondEighth.productId)!], cart)
		await verifyCart(lines)
		await submitScenarioOrder(lines, products)
	})

	test('J2: all five bulk rules and distinct eighth SKUs survive order placement',
		{ annotation: { type: 'bulk-case', description: 'J2 All Categories' } }, async () => {
		const products = await catalogue()
		const lines: CartLine[] = resolvePlan(goldenPlans.find(plan => plan.id === 'J2'), products).requests
		await buildCart(lines, products)
		await verifyCart(lines)
		await submitScenarioOrder(lines, products)
	})

	test('J5: newly registered user retains bulk discounts after logout/login',
		{ annotation: { type: 'bulk-case', description: 'J5 Relogin' } }, async () => {
		if (!cleanupUser) throw new Error('Fresh registration did not provide test credentials')
		const user = cleanupUser
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
		await submitScenarioOrder(lines, products)
	})

	test('J5: freshly registered user receives bulk pricing on their first order',
		{ annotation: { type: 'bulk-case', description: 'J5 First Order' } }, async () => {
		const products = await catalogue()
		const lines: CartLine[] = resolvePlan(goldenPlans.find(plan => plan.id === 'J5'), products).requests
		await buildCart(lines, products)
		await verifyCart(lines)
		await submitScenarioOrder(lines, products)
	})
})
