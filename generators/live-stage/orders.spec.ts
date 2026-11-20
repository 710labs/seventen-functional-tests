import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { LiveNonProdCartFlow } from '../../models/always-on/live-nonprod-cart-flow'
import { LiveNonProdCheckoutPage } from '../../models/always-on/live-nonprod-checkout-page'
import { OrderConfirmationPage } from '../../models/always-on/order-confirmation'

const { STAGE_URL, ORDERS_PER_POS, selectTargets, assertStageUrl, transmissionProblem } =
	require('../../support/live-order-generator/targets.cjs')
const { posOrderDetails } = require('../../support/live-order-generator/pos-links.cjs')
const selectedTargets = selectTargets(process.env.LIVE_ORDER_POS || 'all')
const resultDirectory = path.resolve('output/live-order-generator')

test.beforeAll(async ({}, info) => {
	if (info.config.projects.length !== 1 || info.project.repeatEach !== 1 || info.project.retries !== 0) {
		throw new Error('The generator requires one project, one repetition, and no retries')
	}
	if (info.project.use.baseURL !== STAGE_URL) throw new Error('The generator requires the Live Stage config')
	for (const key of ['ALWAYS_ON_PASSWORD', 'CHECKOUT_PASSWORD', 'LIVE_STAGE_QA_AUTH']) {
		if (!process.env[key]?.trim()) throw new Error(`Missing required Stage generator secret: ${key}`)
	}
})

for (const target of selectedTargets) {
	for (let sequence = 1; sequence <= ORDERS_PER_POS; sequence += 1) {
		test(`${target.pos} — ${target.store} — order ${sequence} of ${ORDERS_PER_POS}`, async ({ page }) => {
			const recordFile = path.join(resultDirectory, `${target.pos}-${sequence}.json`)
			mkdirSync(resultDirectory, { recursive: true })
			// Do not overwrite evidence from a prior invocation or partial run.
			if (existsSync(recordFile)) throw new Error('Existing order evidence found; archive it before starting a new run')
			const record = { pos: target.pos, store: target.store, instanceId: target.instanceId,
				sequence, orderId: null as string | null, status: 'started', phase: 'registration',
				externalId: null as string | null, posOrderUrl: null as string | null }
			const save = () => writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n')
			save()
			try {
				// Also stop cross-origin navigation if a Stage link changes unexpectedly.
				await page.route('**/*', async route => {
					if (route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()) {
						try { assertStageUrl(route.request().url()) } catch { await route.abort(); return }
					}
					await route.continue()
				})
				const storefrontUrl = `${STAGE_URL}/shop/${target.slug}/`
				await page.goto(storefrontUrl)
				await expect(page.getByRole('heading', { name: target.store, exact: true })).toBeVisible()
				await page.goto(`${STAGE_URL}/register/`)
				const registration = page.locator('form.woocommerce-form-register')
				const email = `livegen-${Date.now()}-${randomBytes(3).toString('hex')}@example.com`
				const posName = target.pos.charAt(0).toUpperCase() + target.pos.slice(1)
				const customerName = `Test_710Labs_${posName}_${sequence}`
				await registration.locator('#reg_firstname').fill(customerName)
				await registration.locator('#reg_lastname').fill(customerName)
				await registration.locator('#reg_email').fill(email)
				await registration.locator('#reg_password').fill(process.env.ALWAYS_ON_PASSWORD!)
				await registration.locator('#reg_postalcode').fill('90232')
				await registration.locator('#reg_dob').fill('1990-01-01')
				// Stage populates the cached registration form's nonce asynchronously.
				await expect(registration.locator('[name="woocommerce-register-nonce"]')).toHaveValue(/\S+/)
				await registration.getByRole('button', { name: 'Create account', exact: true }).click()
				await expect(registration).toBeHidden({ timeout: 30000 })
				await expect(page.locator('body')).toHaveClass(/\blogged-in\b/, { timeout: 30000 })
				record.phase = 'cart'
				save()
				await page.goto(storefrontUrl)
				await expect(page.locator('body')).toHaveClass(/\blogged-in\b/)
				const cart = new LiveNonProdCartFlow(page, {
					startWithEmptyCart: true,
					target: { storefrontUrl, instanceId: target.instanceId, facilityId: target.facilityId, method: 'pickup' },
				})
				await cart.addProductsUntilCheckout('rec')
				record.phase = 'checkout'
				save()
				const checkout = new LiveNonProdCheckoutPage(page)
				await checkout.verifyCheckoutPageLoads(page)
				// This initial generator uses pickup to avoid delivery coverage and scheduling dependencies.
				await expect(checkout.pickUpLocationTitle).toBeVisible()
				await checkout.completeRecCheckout(page, '', '')
				assertStageUrl(page.url())
				await expect(checkout.orderReviewSection).toBeVisible()
				await checkout.passwordCheckoutField.fill(process.env.CHECKOUT_PASSWORD!)
				await checkout.submitPasswordButton.click()
				await expect(checkout.placeOrderButton).toBeVisible()
				await expect(checkout.placeOrderButton).toBeEnabled()
				record.status = 'submitting'
				record.phase = 'submission'
				save()
				await checkout.placeOrderButton.click()
				const confirmation = new OrderConfirmationPage(page)
				// Capture the ID before any later confirmation or POS assertion can fail.
				await expect(confirmation.orderNumberElement).toBeVisible({ timeout: 60000 })
				record.orderId = await confirmation.getOrderNumber()
				expect(record.orderId).toMatch(/^\d+$/)
				record.status = 'created'
				record.phase = 'verification'
				save()
				await expect.poll(async () => {
					const url = new URL('/wp-content/plugins/persy/interface/qa/orders/', STAGE_URL)
					url.searchParams.set('auth', process.env.LIVE_STAGE_QA_AUTH!)
					url.searchParams.set('id', record.orderId!)
					try {
						const response = await page.request.get(url.href, { timeout: 15000, maxRedirects: 0 })
						if (!response.ok()) return `POS API HTTP ${response.status()}`
						const body = await response.json()
						const details = posOrderDetails(body, target)
						if (details.externalId) {
							record.posOrderUrl = details.posOrderUrl || (record.externalId === details.externalId ? record.posOrderUrl : null)
							record.externalId = details.externalId
							save()
						}
						const problem = transmissionProblem(body, target)
						return problem
					} catch { return 'POS API unavailable or invalid response' }
				}, { timeout: 90000, intervals: [1000, 5000, 10000], message: 'Order must reach the intended POS instance' }).toBeNull()
				record.status = 'verified'
				save()
			} catch (error) {
				// Keep submitting/created states: a checkout timeout can still have created
				// an order. Never resubmit automatically when the outcome is ambiguous.
				if (record.status === 'started') record.status = 'failed-before-submit'
				save()
				throw error
			}
		})
	}
}
