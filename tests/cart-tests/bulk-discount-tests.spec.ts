import { randomUUID } from 'node:crypto'
import { bulkStateProfiles } from '../../support/bulk-discounts/state-profiles'
import { getRatesBucketForUsage } from '../../utils/usage-types'
import { readStoreTaxConfiguration } from '../../support/bulk-discounts/store-tax-configuration'
import { test, expect } from '../../options'
import { AgeGatePage } from '../../models/age-gate-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { LoginPage } from '../../models/login-page'
import { MyAccountPage } from '../../models/my-account-page'
import { ShopPage, ProductInventoryUnavailableError, type CategoryProductCandidate } from '../../models/shop-page'
import { CartPage } from '../../models/cart-page'
import { CheckoutPage } from '../../models/checkout-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'

const rules = require('../../support/bulk-discounts/rules.json')
const { expectedCart: calculateExpectedCart } = require('../../support/bulk-discounts/oracle.cjs')
const { rulesForEnvironment } = require('../../support/bulk-discounts/tax-profiles.cjs')
const { rulesWithCartTaxRates } = require('../../support/bulk-discounts/cart-tax-rates.cjs')
const { bindCategoryIds, remapPlanCategories } = require('../../support/bulk-discounts/categories.cjs')
const { resolvePlan, goldenPlans, ScenarioInventoryUnavailableError } = require('../../support/bulk-discounts/scenarios.cjs')
const { assertBulkBaseUrl, assertBulkNavigationUrl } = require('../../support/bulk-discounts/environment.cjs')

type CartLine = {
	productId: number; categoryIds: number[]; qty: number; unitPrice: string; isFreeBogoUnit: boolean
}

for (const profile of bulkStateProfiles) {
	const address = `${profile.street}, ${profile.city}, ${profile.state} ${profile.zip}`
	test.describe(`Bulk discounts ${profile.state}`, { tag: [`@${profile.state}`, '@bulk'] }, () => {
		// Retrying an order test could create a second order after a confirmation failure.
		test.describe.configure({ retries: 0 })
		let liveRules: ReturnType<typeof rulesForEnvironment>
		let isStage: boolean
		let taxRatesCaptured = false
		let captureTaxRules: () => Promise<void>
		const expectedCart = (lines: CartLine[], user = 'plain') => {
			if (!taxRatesCaptured) throw new Error('Capture the selected store tax rates before calculating live expectations')
			return calculateExpectedCart(lines, user, liveRules)
		}
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

		test.beforeEach(async ({ page, baseURL, browser, storageState, browserName, qaClient }, testInfo) => {
			signedIn = false
			cartTouched = false
			cleanupUser = undefined
			// Stage runs each state through its existing state job; production remains excluded.
			test.skip(testInfo.config.metadata.bulkDiscounts !== true, 'Bulk rules are enabled only in the dev and staging configurations')
			const targetOrigin = assertBulkBaseUrl(baseURL)
			isStage = targetOrigin === 'https://thelist-stage.710labs.com'
			test.skip(profile.state !== 'CA' && !isStage, 'Additional state coverage is enabled on Stage')
			liveRules = rulesForEnvironment(targetOrigin)
			taxRatesCaptured = false
			await page.context().route('**/*', async route => {
				const request = route.request()
				if (request.isNavigationRequest() && request.frame().parentFrame() === null) {
					try { assertBulkNavigationUrl(request.url(), targetOrigin) } catch { await route.abort('blockedbyclient'); return }
				}
				await route.continue()
			})
			shop = new ShopPage(page, browserName, testInfo, { deliveryAddress: address })
			cart = new CartPage(page, qaClient, browserName, testInfo, profile.usage)
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
				firstName: `Bulk ${profile.state} ${caseName}`, lastName: testInfo.project.name,
				email: `test+bulk-${profile.state.toLowerCase()}-${caseSlug}-${projectSlug}-${runId.slice(0, 12)}@710labs-test.com`, password: 'test1234',
				orderNote: `bulk-regression:${profile.state}:${caseName}:${testInfo.project.name}:${runId}`,
			}
			expect(cleanupUser.email.length, 'WordPress username length limit').toBeLessThanOrEqual(60)
			if (profile.state === 'MI') {
				await createAccount.createMichiganCustomer(cleanupUser.firstName, cleanupUser.lastName, cleanupUser.email, cleanupUser.password,
					16, 12, 1990, '5551234567', profile.usage, address, '1234567890', 'M123456789012')
			} else {
				await createAccount.create(cleanupUser.firstName, cleanupUser.lastName, cleanupUser.email, cleanupUser.password,
					profile.zip, profile.usage, false, address, profile.state)
			}
			// Registration leaves this test's new account signed in.
			signedIn = true
			if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') await account.addAddress(profile.street, profile.city, profile.state, profile.zip)
			await shop.goToCart()
			await cart.verifyEmpty()
			captureTaxRules = async () => {
				const metadata = await cart.getTaxRateMetadata()
				const configuredRates = profile.state === 'CA' ? undefined
					: await readStoreTaxConfiguration(browser, targetOrigin, storageState, getRatesBucketForUsage(profile.usage))
				if (profile.state !== 'CA' && !Array.isArray(configuredRates)) throw new Error(`Missing tax configuration for ${profile.state} ${profile.usage}`)
				const location = configuredRates && metadata.length === 0 ? await shop.getFulfillmentTaxLocation() : undefined
				liveRules = rulesWithCartTaxRates(liveRules, metadata, configuredRates, location)
				if (location) testInfo.annotations.push({ type: 'tax-jurisdiction', description: `${location.country}-${location.state}: no configured taxes` })
			}
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
			await shop.openStorefrontForFulfillment(profile.fulfillment)
			test.info().annotations.push({ type: 'fulfillment-store', description: await shop.getFulfillmentLabel() })
			const categoryIds = await shop.getCategoryIdsBySlug(rules.bulkRules.map(rule => rule.categorySlug), { allowMissing: isStage })
			liveRules = bindCategoryIds(liveRules, categoryIds, { allowMissing: isStage })
			test.info().annotations.push({ type: 'category-map', description: JSON.stringify(categoryIds) })
			test.info().annotations.push({ type: 'bulk-rules', description: liveRules.bulkRules
				.map(rule => `${rule.categoryName}: ${rule.enabled === false ? 'no bulk discount' : 'enabled'}`).join(', ') })
			const products = await shop.getCategoryProducts(liveRules.bulkRules.map(rule => rule.categoryId), profile.usage, { readBulkOffers: isStage })
			for (const product of products) {
				expect(liveRules.bulkRules.filter(rule => product.categoryIds.includes(rule.categoryId)),
					`Product ${product.productId} must not belong to multiple bulk categories`).toHaveLength(1)
			}
			return products
		}

		async function buildCart(lines: CartLine[], products: CategoryProductCandidate[], requiredQuantities = lines.map(line => line.qty)) {
			cartTouched = true
			const used = new Set<number>()
			for (const [index, line] of lines.entries()) {
				const candidates = products.filter(product => !used.has(product.productId) && product.productId !== rules.bogo.productId &&
					liveRules.bulkRules.some(rule => line.categoryIds.includes(rule.categoryId) && product.categoryIds.includes(rule.categoryId)))
					.sort((a, b) => Number(b.productId === line.productId) - Number(a.productId === line.productId) || Number(a.unitPrice) - Number(b.unitPrice) || a.productId - b.productId)
				const selected = await shop.addQuantityCapableProduct(candidates, cart, requiredQuantities[index], profile.usage)
				Object.assign(line, { productId: selected.productId, categoryIds: selected.categoryIds, unitPrice: selected.unitPrice })
				used.add(selected.productId)
				if (line.qty !== 1) await cart.setProductQuantity(line.productId, line.qty)
			}
		}

		function notApplicable(reason: string): undefined {
			test.info().annotations.push({ type: 'bulk-not-applicable', description: reason })
			return undefined
		}

		async function prepareScenario(referenceCategoryIds: number[], makeLines: (products: CategoryProductCandidate[]) => CartLine[],
			requiredQuantities?: (lines: CartLine[]) => number[]) {
			let products = await catalogue()
			if (isStage) {
				for (const categoryId of new Set(referenceCategoryIds)) {
					const reference = rules.bulkRules.find(rule => rule.categoryId === categoryId)
					if (!reference) throw new Error(`Unknown scenario category: ${categoryId}`)
					const rule = liveRules.bulkRules.find(live => live.categorySlug === reference.categorySlug)
					if (!rule) return notApplicable(`${reference.categoryName}: category is unavailable`)
					const eligible = products.filter(product => product.categoryIds.includes(rule.categoryId) && product.productId !== rules.bogo.productId)
					if (!eligible.length) return notApplicable(`${rule.categoryName}: no addable products at the selected store`)
					if (rule.enabled !== false && !eligible.some(product => product.hasBulkOffer)) {
						return notApplicable(`${rule.categoryName}: the selected store does not advertise this bulk discount`)
					}
				}
				// Only use advertised offers for active rules. Keep Doinks as a full-price control.
				products = products.filter(product => product.hasBulkOffer ||
					liveRules.bulkRules.some(rule => rule.enabled === false && product.categoryIds.includes(rule.categoryId)))
			}
			try {
				const lines = makeLines(products)
				await buildCart(lines, products, requiredQuantities?.(lines))
				return { lines, products }
			} catch (error) {
				if (!isStage || !(error instanceof ScenarioInventoryUnavailableError || error instanceof ProductInventoryUnavailableError)) throw error
				return notApplicable(error.message)
			}
		}

		function prepareJourney(id: string, requiredQuantities?: (lines: CartLine[]) => number[]) {
			const plan = goldenPlans.find(plan => plan.id === id)
			return prepareScenario(plan.lines.map(line => line.categoryId), products =>
				resolvePlan(remapPlanCategories(plan, rules, liveRules), products, liveRules).requests, requiredQuantities)
		}

		async function verifyCart(lines: CartLine[], user = 'plain') {
			if (!taxRatesCaptured) {
				await captureTaxRules()
				taxRatesCaptured = true
				test.info().annotations.push({ type: 'tax-profile', description: 'Selected store: ' +
					liveRules.taxes.map(tax => `${tax.label || tax.key} ${tax.rateBasisPoints / 100}%`).join(', ') })
			}
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
					throw new Error(`Cannot determine the order minimum shortfall: ${minimum.text}`)
				}
				if (!companion) {
					const product = [...products].sort((a, b) => Number(b.unitPrice) - Number(a.unitPrice))
						.find(product => product.productId !== rules.bogo.productId &&
							product.categoryIds.every(id => !scenarioCategories.has(id)))
					if (!product) throw new Error('Need a companion product outside the scenario categories to meet the order minimum')
					await shop.openStorefrontForFulfillment(profile.fulfillment)
					await shop.addSelectedProducts([product], cart, profile.usage)
					companion = { productId: product.productId, categoryIds: product.categoryIds,
						unitPrice: product.unitPrice, qty: 1, isFreeBogoUnit: false }
					lines.push(companion)
				} else {
					companion.qty += Math.max(1, Math.ceil(minimum.remainingAmount / Number(companion.unitPrice)))
					await cart.setProductQuantity(companion.productId, companion.qty)
				}
				await verifyCart(lines)
			}
			expect((await shop.getMinimumOrderBannerState()).isVisible, 'The order must meet the order minimum').toBe(false)
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
				const prepared = await prepareScenario([rule.categoryId], products => {
					const categoryId = liveRules.bulkRules.find(live => live.categorySlug === rule.categorySlug).categoryId
					const product = products.find(product => product.categoryIds.includes(categoryId) && product.productId !== rules.bogo.productId)
					if (!product) throw new Error(`Need an addable product in category ${rule.categorySlug} (${categoryId})`)
					return [{ productId: product.productId, categoryIds: product.categoryIds, unitPrice: product.unitPrice, qty: 2, isFreeBogoUnit: false }]
				}, () => [6])
				if (!prepared) return
				const { lines: [line], products } = prepared
				for (const quantity of [2, 3, 4, 5, 6, 4, 5]) {
					await test.step(`Verify ${quantity} paid units`, async () => {
						if (quantity !== line.qty) await cart.setProductQuantity(line.productId, quantity)
						line.qty = quantity
						await verifyCart([line])
					})
				}
				await submitScenarioOrder([line], products)
			})
		}

		test('J1: cross-SKU tiers, removal and re-addition through order placement',
			{ annotation: { type: 'bulk-case', description: 'J1 Cross SKU' } }, async () => {
			const prepared = await prepareJourney('J1', lines => lines.map((line, index) => index === 1 ? 3 : line.qty))
			if (!prepared) return
			const { lines, products } = prepared
			await verifyCart(lines)
			const secondEighth = lines[1]
			for (const quantity of [3, 1]) {
				await cart.setProductQuantity(secondEighth.productId, quantity)
				secondEighth.qty = quantity
				await verifyCart(lines)
			}
			await cart.removeProduct(secondEighth.productId)
			await verifyCart(lines.filter(line => line !== secondEighth))
			await shop.openStorefrontForFulfillment(profile.fulfillment)
			await shop.addSelectedProducts([products.find(product => product.productId === secondEighth.productId)!], cart, profile.usage)
			await verifyCart(lines)
			await submitScenarioOrder(lines, products)
		})

		test('J2: all configured bulk rules and distinct eighth SKUs survive order placement',
			{ annotation: { type: 'bulk-case', description: 'J2 All Categories' } }, async () => {
			const prepared = await prepareJourney('J2')
			if (!prepared) return
			const { lines, products } = prepared
			await verifyCart(lines)
			await submitScenarioOrder(lines, products)
		})

		test('J5: newly registered user retains bulk discounts after logout/login',
			{ annotation: { type: 'bulk-case', description: 'J5 Relogin' } }, async () => {
			if (!cleanupUser) throw new Error('Fresh registration did not provide test credentials')
			const user = cleanupUser
			const prepared = await prepareJourney('J5')
			if (!prepared) return
			const { lines, products } = prepared
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
			const prepared = await prepareJourney('J5')
			if (!prepared) return
			const { lines, products } = prepared
			await verifyCart(lines)
			await submitScenarioOrder(lines, products)
		})
	})
}
