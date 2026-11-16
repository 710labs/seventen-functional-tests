import { appendFileSync, writeFileSync } from 'node:fs'
import { faker } from '@faker-js/faker'
import { expect, test } from '../../options'
import { AgeGatePage } from '../../models/age-gate-page'
import { CartPage } from '../../models/cart-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'
import { RecreationalInventoryUnavailableError, ShopPage, type ShopFulfillment } from '../../models/shop-page'
import { withQueueItDetection } from '../../support/queueit'
import { getSmokeCartItemCount } from '../../utils/smoke-cart-item-count'
import { getUsageLabel, type TestUsageType } from '../../utils/usage-types'

type SmokeAddress = { fullAddress: string; zipcode: string }

type ProductionSmokeProfile = {
	state: 'CA' | 'CO' | 'FL' | 'MI' | 'NJ'
	address: () => SmokeAddress
	fulfillment: ShopFulfillment
	cartDestination?: '/reservations'
}

export function runListProductionSmoke(profile: ProductionSmokeProfile) {
	const { state, fulfillment, cartDestination } = profile
	const itemCount = state === 'FL' ? 6 : getSmokeCartItemCount()
	const usages: TestUsageType[] = state === 'FL' ? ['medical'] : ['recreational', 'medical']

	test.describe(`Basic Acceptance Tests ${state}`, () => {
		for (const usage of usages) {
			const tags = [`@${usage}`, '@smoke']
			if (state === 'CA' && usage === 'recreational') tags.push('@rec')
			test(`Basic Acceptance Test - ${getUsageLabel(usage)}`, { tag: tags }, async ({ page, browserName, qaClient }, info) => {
				test.skip(state !== 'CA' && info.project.name === 'Mobile Chrome', 'This state’s production checkout smoke runs on desktop.')
				await withQueueItDetection(page, info, async () => {
					const { fullAddress, zipcode } = profile.address()
					const firstName = `${faker.name.firstName()}_Test`
					const lastName = `${faker.name.lastName()}_Test`
					const email = faker.internet.email(firstName, lastName, 'test710labstest.com')
					const createAccount = new CreateAccountPage(page, qaClient)
					const shop = new ShopPage(page, browserName, info)
					const cart = new CartPage(page, qaClient, browserName, info, usage)
					const checkout = new CheckoutPage(page, qaClient)

					const needsListPassword = await new AgeGatePage(page).passAgeGate({ allowDirectRegistration: state === 'FL' })
					if (needsListPassword) await new ListPasswordPage(page).submitPassword(process.env.CHECKOUT_PASSWORD || '')
					await test.step(`Register a ${getUsageLabel(usage).toLowerCase()} customer`, async () => {
						if (state === 'MI') {
							await createAccount.createMichiganCustomer(
								firstName, lastName, email, faker.internet.password(), 16, 12, 1988,
								faker.phone.phoneNumber('555-###-####'), usage, fullAddress,
								faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
								faker.datatype.number({ min: 11111111, max: 99999999 }).toString(),
							)
						} else {
							await createAccount.create(firstName, lastName, email, 'test1234', zipcode, usage, false, fullAddress, state)
						}
					})

					try {
						await shop.addProductsUntilCheckoutReady(cart, itemCount, fulfillment, usage, cartDestination)
					} catch (error) {
						if (!(error instanceof RecreationalInventoryUnavailableError)) throw error
						test.skip(true, `Recreational registration passed. Checkout skipped. ${error.message}`)
					}

					if (state === 'MI') {
						await cart.goToCheckout()
						await checkout.selectSlot()
						await checkout.submitOrder()
					} else {
						const cartTotals = await cart.verifyCart(zipcode)
						await checkout.confirmCheckout(zipcode, cartTotals, usage, true, fullAddress)
					}

					await test.step('Confirm and record the order for cleanup', async () => {
						const orderNumber = (await new OrderReceivedPage(page).getOrderNumber()).trim()
						expect(orderNumber, 'Expected a valid order number').toMatch(/^\d+$/)
						appendFileSync('order_ids.txt', `${orderNumber}\n`, 'utf8')
						writeFileSync('order_id.txt', orderNumber, 'utf8')
					})
				})
			})
		}
	})
}
