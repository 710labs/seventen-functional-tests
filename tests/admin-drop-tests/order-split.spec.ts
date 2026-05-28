import type { BrowserContext, Page, TestInfo } from '@playwright/test'
import { expect, test } from '../../options'
import { AgeGatePage } from '../../models/age-gate-page'
import { CartPage } from '../../models/cart-page'
import { CheckoutPage } from '../../models/checkout-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { EditOrderPage } from '../../models/admin/edit-order-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { MyAccountPage } from '../../models/my-account-page'
import { OrderReceivedPage } from '../../models/order-recieved-page'
import { ShopPage } from '../../models/shop-page'
import { buildStorageStateWithRecaptchaBypass } from '../../support/qa/recaptcha-bypass'
import type { QAClient } from '../../support/qa/client'

const splitOrderItemCount = 2
const splitOrderMaxRandomizedItems = 2
const requiredPublishedProductCount = splitOrderItemCount + splitOrderMaxRandomizedItems

function buildStorefrontCustomer(testInfo: TestInfo) {
	const uniqueId = `${Date.now()}-${testInfo.workerIndex}`

	return {
		address: '440 N Rodeo Dr, Beverly Hills, CA 90210',
		email: `admin-drop-split-${uniqueId}@test710labstest.com`,
		firstName: `Split${testInfo.workerIndex}`,
		lastName: `Smoke${Date.now()}`,
		password: 'test1234',
		zipCode: '90210',
	}
}

async function attachJson(testInfo: TestInfo, name: string, body: unknown) {
	await testInfo.attach(name, {
		body: JSON.stringify(body, null, 2),
		contentType: 'application/json',
	})
}

async function assertPublishedProductsExist(page: Page, testInfo: TestInfo) {
	await test.step('Verify published products exist in admin', async () => {
		await page.goto('/wp-admin/edit.php?post_status=publish&post_type=product&paged=1')
		await expect(page).toHaveURL(/post_type=product/)

		const productRows = page.locator('#the-list tr[id^="post-"]')
		const productCount = await productRows.count()
		const emptyStateVisible = await page
			.locator('#the-list .no-items')
			.first()
			.isVisible()
			.catch(() => false)

		await attachJson(testInfo, 'order-split-admin-product-preflight', {
			productCount,
			emptyStateVisible,
			url: page.url(),
		})

		if (productCount < requiredPublishedProductCount || emptyStateVisible) {
			throw new Error(
				[
					`Order-split smoke requires at least ${requiredPublishedProductCount} published products before creating the storefront order.`,
					'Run the menu-upload smoke first if this environment has no published menu.',
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

async function createStorefrontOrder({
	browserName,
	onOrderCreated,
	page,
	qaClient,
	testInfo,
}: {
	browserName: string
	onOrderCreated?: (orderNumber: string) => void
	page: Page
	qaClient: QAClient
	testInfo: TestInfo
}) {
	const customer = buildStorefrontCustomer(testInfo)
	const shopPage = new ShopPage(page, browserName, testInfo)
	const cartPage = new CartPage(page, qaClient, browserName, testInfo, 'recreational')
	const checkoutPage = new CheckoutPage(page, qaClient)
	const orderReceivedPage = new OrderReceivedPage(page)
	const createAccountPage = new CreateAccountPage(page, qaClient)
	const myAccountPage = new MyAccountPage(page)

	await passStorefrontGates(page)
	await page.goto('/my-account/')
	await createAccountPage.create(
		customer.firstName,
		customer.lastName,
		customer.email,
		customer.password,
		customer.zipCode,
		'recreational',
		false,
		customer.address,
		'CA',
	)
	if (process.env.ADD_ADDRESS_BEFORE_CHECKOUT === 'true') {
		await myAccountPage.addAddress()
	}

	await shopPage.addProductsToCart(splitOrderItemCount, false, 'Delivery', 'recreational')
	const cartTotals = await cartPage.verifyCart(customer.zipCode)
	await checkoutPage.confirmCheckout(customer.zipCode, cartTotals, 'recreational', true, customer.address)
	const orderNumber = await orderReceivedPage.getOrderNumber()
	onOrderCreated?.(orderNumber)

	await expect(page).toHaveURL(/order-received/)
	expect(orderNumber, 'Expected order-split smoke to place an order').toBeTruthy()

	return {
		customer,
		orderNumber,
		url: page.url(),
	}
}

test('Admin can split a storefront order @split', async ({
	page,
	browser,
	browserName,
	qaClient,
}, testInfo) => {
	const editOrderPage = new EditOrderPage(page)
	const cleanupErrors: string[] = []
	let storefrontContext: BrowserContext | undefined
	let createdOrderNumber: string | undefined
	let splitOrderNumber: string | undefined
	let mainError: unknown

	try {
		await assertPublishedProductsExist(page, testInfo)

		const createdOrder = await test.step('Create storefront order for split', async () => {
			storefrontContext = await browser.newContext({
				baseURL: process.env.BASE_URL,
				storageState: buildStorageStateWithRecaptchaBypass(process.env.BASE_URL),
			})
			const storefrontPage = await storefrontContext.newPage()

			return createStorefrontOrder({
				browserName,
				onOrderCreated: orderNumber => {
					createdOrderNumber = orderNumber
				},
				page: storefrontPage,
				qaClient,
				testInfo,
			})
		})

		createdOrderNumber = createdOrder.orderNumber
		await attachJson(testInfo, 'order-split-created-order', createdOrder)

		splitOrderNumber = await editOrderPage.splitOrder(createdOrderNumber)
		await attachJson(testInfo, 'order-split-result', {
			originalOrderNumber: createdOrderNumber,
			splitOrderNumber,
			url: page.url(),
		})
	} catch (error) {
		mainError = error
	} finally {
		if (storefrontContext) {
			await storefrontContext.close()
		}

		const orderNumbersToCancel = Array.from(
			new Set(
				[splitOrderNumber, createdOrderNumber].filter(
					(orderNumber): orderNumber is string => Boolean(orderNumber),
				),
			),
		)

		for (const orderNumber of orderNumbersToCancel) {
			try {
				await editOrderPage.cancelOrder(orderNumber)
			} catch (cleanupError) {
				cleanupErrors.push(`Failed to cancel order ${orderNumber}: ${cleanupError}`)
			}
		}
	}

	if (cleanupErrors.length) {
		const mainErrorMessage = mainError ? `Main test error: ${mainError}` : null
		throw new Error([...cleanupErrors, mainErrorMessage].filter(Boolean).join('\n'))
	}

	if (mainError) {
		throw mainError
	}
})
