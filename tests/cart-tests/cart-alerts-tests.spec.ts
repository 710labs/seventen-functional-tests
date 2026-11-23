import { expect, test } from '../../options'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { AgeGatePage } from '../../models/age-gate-page'
import { LoginPage } from '../../models/login-page'
import { ShopPage } from '../../models/shop-page'
import { CartPage } from '../../models/cart-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { MyAccountPage } from '../../models/my-account-page'
import { buildListOrderCart } from '../../support/list-order-cart'
import { moneyInCents } from '../../models/components/order-pricing'
import type { Locator } from '@playwright/test'

type CartTimerState = 'ca' | 'co' | 'mi' | 'nj'

function getCartTimerState(): CartTimerState {
	const envId = (process.env.ENV_ID || '').toLowerCase()
	const baseUrl = (process.env.BASE_URL || '').toLowerCase()

	if (/(^|-)co($|-)/.test(envId) || baseUrl.includes('thelist-co')) {
		return 'co'
	}

	if (/(^|-)mi($|-)/.test(envId) || baseUrl.includes('thelist-mi')) {
		return 'mi'
	}

	if (/(^|-)nj($|-)/.test(envId) || baseUrl.includes('thelist-nj')) {
		return 'nj'
	}

	return 'ca'
}

async function addCartTimerAddress(myAccountPage: MyAccountPage) {
	switch (getCartTimerState()) {
		case 'co':
			await myAccountPage.addColoradoAddress()
			return
		case 'mi':
			await myAccountPage.addAddress('123 Eight Mile Rd', 'Detroit', 'MI', '48203')
			return
		case 'nj':
			await myAccountPage.addAddress('13 Huntley Rd', 'Summit City', 'NJ', '07901')
			return
		default:
			await myAccountPage.addAddress()
	}
}

async function readShortfallInCents(message: Locator) {
	const text = (await message.innerText()).replace(/\s+/g, ' ').trim()
	const match = text.match(/\bAdd\s+(\$\s*[\d,]+(?:\.\d{2})?)\s+to check out\.?$/i)
	expect(match, `Expected an Add $X to check out message, received: ${text}`).not.toBeNull()
	return moneyInCents(match![1], true)
}

test('Cart Timer Is Visible and gates Checkout on the cart minimum @MI @CA @CO @NJ', async ({ page, browserName, qaClient }, workerInfo) => {
	const ageGatePage = new AgeGatePage(page)
	const listPassword = new ListPasswordPage(page)
	const createAccountPage = new CreateAccountPage(page, qaClient)
	const loginPage = new LoginPage(page)
	const myAccountPage = new MyAccountPage(page)
	const shopPage = new ShopPage(page, browserName, workerInfo)
	const cartPage = new CartPage(page, qaClient, browserName, workerInfo, 'recreational')

	await ageGatePage.passAgeGate()
	await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
	const user = await createAccountPage.createApi('recreational', 'current')
	await loginPage.login(user.email, user.password)
	await addCartTimerAddress(myAccountPage)

	if (new URL(page.url()).hostname !== 'thelist-dev.710labs.com') {
		await shopPage.addProductsToCart(1, false, 'Pickup', 'recreational', { exactItemCount: true })
		await expect(cartPage.cartCounter).toContainText('Your cart is reserved for')
		return
	}

	try {
		const shopUrl = new URL('/', page.url())
		const checkoutUrl = new URL('/checkout/', shopUrl)
		const isCheckout = (url: URL) => url.origin === shopUrl.origin && /^\/checkout\/?$/.test(url.pathname)
		const timerBar = page.locator('.rsp-zone__inner:visible')
		const countdown = timerBar.locator('.rsp-zone__time')
		const timerAction = timerBar.locator('.rsp-zone__checkout')
		const shortcut = timerBar.getByRole('link', { name: 'Checkout', exact: true })
		// Scope this to cart totals so a matching timer message cannot satisfy both assertions.
		const cartMinimumNotice = page.locator('.wc-proceed-to-checkout .wcse-warning-button')

		await shopPage.goToCart()
		await cartPage.verifyEmpty()
		await shopPage.openStorefrontForFulfillment('Pickup')
		const minimumInCents = await test.step('Read the selected pickup minimum independently of the cart messages', async () => {
			await page.locator('button.wcse-nav').first().click()
			const fulfillment = page.locator('#fulfillmentElement')
			await expect(fulfillment).toBeVisible()
			await expect(fulfillment).toHaveAttribute('data-toggle', 'pickup')
			await expect(fulfillment.locator('#pickupType')).toBeChecked()
			const pickupDetails = fulfillment.locator('.wcse-reactive--pickup-footer')
			await expect(pickupDetails).toBeVisible()
			const text = (await pickupDetails.innerText()).replace(/\s+/g, ' ').trim()
			const match = text.match(/(\$\s*[\d,]+(?:\.\d{2})?)\s+Minimum\b/i)
			expect(match, `Selected pickup location must state its minimum: ${text}`).not.toBeNull()
			const minimum = moneyInCents(match![1], true)
			expect(minimum, 'A positive pickup minimum is required to exercise the blocked timer').toBeGreaterThan(0)
			await fulfillment.locator('#fulfillerSubmit').click()
			await expect(fulfillment).toBeHidden()
			return minimum
		})

		const products = (await shopPage.getAddableStorefrontProducts('recreational'))
			.filter(product => product.price > 0 && Math.round(product.price * 100) < minimumInCents)
			.sort((left, right) => left.price - right.price)
		expect(products.length, 'The menu must contain a recreational product below the pickup minimum').toBeGreaterThan(0)

		// A second cheap product exercises a changed shortfall while the cart is still blocked.
		const underMinimumProducts = products.slice(0, 2)
		if (underMinimumProducts.reduce((sum, product) => sum + Math.round(product.price * 100), 0) >= minimumInCents) {
			underMinimumProducts.splice(1)
		}
		let previousShortfall = minimumInCents
		for (const product of underMinimumProducts) {
			await test.step(`Verify timer and cart shortfall after adding ${product.name}`, async () => {
				// Inspect the AJAX-updated banner on the shop before navigating to the cart.
				await shopPage.addStorefrontProduct(product, 'recreational')
				await expect(timerAction).toBeVisible()
				await expect(timerAction).toHaveAttribute('aria-disabled', 'true')
				await expect(timerAction).not.toHaveAttribute('href')
				await expect(timerAction.locator('a, button')).toHaveCount(0)
				await expect(shortcut).toHaveCount(0)
				await expect.poll(() => readShortfallInCents(timerAction), {
					message: 'Adding a product must reduce the timer shortfall without leaving the shop',
				}).toBeLessThan(previousShortfall)
				const shopShortfall = await readShortfallInCents(timerAction)
				expect(shopShortfall).toBeGreaterThan(0)

				await shopPage.goToCart({ requireItems: true })
				const subtotalInCents = Math.round((await shopPage.getCartSubtotalAmount()) * 100)
				const expectedShortfall = minimumInCents - subtotalInCents
				expect(expectedShortfall, 'This cart must be below the configured pickup minimum').toBeGreaterThan(0)
				expect(shopShortfall, 'Shop timer must show configured minimum minus actual cart subtotal').toBe(expectedShortfall)
				await expect(cartMinimumNotice).toBeVisible()
				await expect(cartMinimumNotice).toContainText('Pickup minimum not met.')
				await expect.poll(() => readShortfallInCents(cartMinimumNotice), {
					message: 'The actual cart shortfall must equal configured minimum minus subtotal',
				}).toBe(expectedShortfall)
				await expect(timerAction).toHaveAttribute('aria-disabled', 'true')
				await expect(timerAction).not.toHaveAttribute('href')
				await expect(shortcut).toHaveCount(0)
				await expect.poll(() => readShortfallInCents(timerAction), {
					message: 'The cart-page timer and the separate cart notice must show the same shortfall',
				}).toBe(expectedShortfall)
				expect((await shopPage.getStorefrontCheckoutState()).isReachable, 'Cart Checkout must remain blocked').toBe(false)
				previousShortfall = expectedShortfall
				await shopPage.openStorefrontForFulfillment('Pickup')
			})
		}

		await test.step('Reach the pickup minimum and replace the shortfall with Checkout', async () => {
			await buildListOrderCart(shopPage, cartPage, 'Pickup', { initialItemCount: 1 })
			const subtotalInCents = Math.round((await shopPage.getCartSubtotalAmount()) * 100)
			expect(subtotalInCents, 'The completed cart must meet the configured pickup minimum').toBeGreaterThanOrEqual(minimumInCents)
			await expect(cartMinimumNotice).toBeHidden()
			await expect(timerAction).toHaveText('Checkout')
			await expect(shortcut).toBeVisible()
			await page.goto(shopUrl.href)
			await expect(timerAction).toHaveText('Checkout')
			await expect(timerAction).not.toHaveAttribute('aria-disabled', 'true')
			await expect(timerBar).not.toContainText(/Add\s+\$/i)
		})

		await test.step('Verify the reservation timer and open checkout from its bar', async () => {
			const label = timerBar.locator('.rsp-zone__label--held')
			await expect(label).toBeVisible()
			await expect(label).toHaveText('Items held for')
			await expect(countdown).toBeVisible()
			await expect(countdown).toHaveText(/^\d{1,2}:[0-5]\d$/)

			await expect(shortcut).toBeEnabled()
			await expect(shortcut).toHaveJSProperty('href', checkoutUrl.href)
			await shortcut.click()
			await expect(page).toHaveURL(isCheckout)
			await expect(page.locator('.woocommerce-checkout-review-order-table')).toBeVisible()
		})

		await test.step('Return to the shop and proceed to checkout through the cart', async () => {
			await page.goBack()
			// Fulfillment UI may add an empty hash when returning to the shop.
			await expect(page).toHaveURL(url => url.origin === shopUrl.origin && url.pathname === shopUrl.pathname)
			await expect(countdown).toBeVisible()
			await shopPage.goToCart({ requireItems: true })
			await cartPage.goToCheckout()
			await expect(page).toHaveURL(isCheckout)
		})
	} finally {
		await shopPage.clearStorefrontCart()
	}
})
