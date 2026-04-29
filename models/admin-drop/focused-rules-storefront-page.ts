import test, { expect, Locator, Page } from '@playwright/test'

const cartNoticeSelector = [
	'.woocommerce-error',
	'.woocommerce-message',
	'.woocommerce-info',
	'.wc-block-components-notice-banner',
	'.wpse-snacktoast',
	'[role="alert"]',
].join(', ')

export class FocusedRulesStorefrontPage {
	readonly page: Page
	readonly ageGateChallenge: Locator
	readonly passAgeGateButton: Locator
	readonly passwordInput: Locator

	constructor(page: Page) {
		this.page = page
		this.ageGateChallenge = page.locator('.age-gate-challenge')
		this.passAgeGateButton = page.getByText("I'm over 21 or a qualified patient", { exact: true })
		this.passwordInput = page.locator('input[name="post_password"]').first()
	}

	async clearCart() {
		await test.step('Clear storefront cart', async () => {
			await this.gotoWithGateHandling('/cart/')

			for (let pass = 0; pass < 20; pass += 1) {
				const removeLink = this.page.locator('.cart_item .product-remove a, a.remove').first()
				const hasRemoveLink = await removeLink.isVisible().catch(() => false)

				if (!hasRemoveLink) {
					return
				}

				await removeLink.click()
				await this.page.waitForLoadState('networkidle').catch(() => {})
				await this.page.waitForTimeout(500)
			}

			throw new Error('Unable to clear storefront cart after 20 remove attempts')
		})
	}

	async addProductBySku(sku: string, quantity = 1) {
		await test.step(`Add SKU ${sku} to cart ${quantity} time(s)`, async () => {
			await this.openShopForPickup()

			for (let index = 0; index < quantity; index += 1) {
				const addButton = await this.findAddToCartButtonBySku(sku)
				await addButton.scrollIntoViewIfNeeded()
				await expect(addButton, `Expected add-to-cart control for SKU ${sku}`).toBeVisible()
				await addButton.click()
				await this.acceptCartConflictIfPresent()
				await this.page.waitForTimeout(1000)
				await this.closeCartDrawerIfPresent()
			}
		})
	}

	async goToCart() {
		await test.step('Open storefront cart', async () => {
			await this.gotoWithGateHandling('/cart/')
			await expect
				.poll(async () => {
					const hasCartItem = await this.page.locator('.cart_item').first().isVisible().catch(() => false)
					const hasEmptyCartText = await this.page.getByText(/cart is currently empty/i).isVisible().catch(() => false)

					return hasCartItem || hasEmptyCartText
				})
				.toBe(true)
		})
	}

	async getCartQuantity(productName: string) {
		return test.step(`Read cart quantity for ${productName}`, async () => {
			const row = this.cartRowByProductName(productName)
			await expect(row, `Expected cart row for ${productName}`).toBeVisible()
			const quantityField = row.locator('input.qty, .qty').first()
			await expect(quantityField, `Expected quantity field for ${productName}`).toBeVisible()

			const tagName = await quantityField.evaluate(element => element.tagName.toLowerCase())

			if (tagName === 'input') {
				return Number.parseInt(await quantityField.inputValue(), 10)
			}

			return Number.parseInt(((await quantityField.textContent()) || '').trim(), 10)
		})
	}

	async setCartQuantity(productName: string, quantity: number) {
		await test.step(`Set cart quantity for ${productName} to ${quantity}`, async () => {
			const row = this.cartRowByProductName(productName)
			await expect(row, `Expected cart row for ${productName}`).toBeVisible()
			const quantityInput = row.locator('input.qty').first()
			await expect(quantityInput, `Expected editable quantity input for ${productName}`).toBeVisible()

			await quantityInput.fill(`${quantity}`)
			await quantityInput.evaluate(element => {
				element.dispatchEvent(new Event('input', { bubbles: true }))
				element.dispatchEvent(new Event('change', { bubbles: true }))
			})
			await quantityInput.press('Tab')

			const updateButton = this.page.locator('button[name="update_cart"], input[name="update_cart"]').first()
			const hasUpdateButton = await updateButton.isVisible().catch(() => false)

			if (hasUpdateButton) {
				await expect(updateButton).toBeEnabled({ timeout: 5000 }).catch(() => {})

				if (await updateButton.isEnabled().catch(() => false)) {
					await updateButton.click()
					await this.page.waitForLoadState('networkidle').catch(() => {})
					await this.page.waitForTimeout(500)
					return
				}
			}

			await quantityInput.press('Enter')
			await this.page.waitForLoadState('networkidle').catch(() => {})
			await this.page.waitForTimeout(500)
		})
	}

	async attemptCheckout() {
		return test.step('Attempt to continue to checkout', async () => {
			const checkoutButton = this.page.locator('.checkout-button, a.checkout-button, button:has-text("Checkout")').first()
			await expect(checkoutButton, 'Expected a checkout button on the cart page').toBeVisible()
			await checkoutButton.click()
			await this.page.waitForLoadState('networkidle').catch(() => {})
			await this.page.waitForTimeout(1000)

			return {
				url: this.page.url(),
				notices: await this.getNoticeText(),
				bodyText: await this.getBodyText(),
			}
		})
	}

	async getNoticeText() {
		const notices = this.page.locator(cartNoticeSelector)
		const count = await notices.count()
		const noticeTexts: string[] = []

		for (let index = 0; index < count; index += 1) {
			const notice = notices.nth(index)
			const isVisible = await notice.isVisible().catch(() => false)

			if (isVisible) {
				noticeTexts.push(((await notice.textContent()) || '').trim())
			}
		}

		return noticeTexts.filter(Boolean).join('\n')
	}

	async getBodyText() {
		return this.page.evaluate(() => document.body.innerText || '')
	}

	hasMinimumOrderBlockText(text: string, minimum: number) {
		const normalizedText = text.replace(/\s+/g, ' ').toLowerCase()

		return (
			/minimum|min\.|at least|required/.test(normalizedText) &&
			(normalizedText.includes(`${minimum}`) || normalizedText.includes(`$${minimum}`))
		)
	}

	private async openShopForPickup() {
		await this.gotoWithGateHandling('/shop/')
		await this.selectPickupIfPresent()
	}

	private async gotoWithGateHandling(path: string) {
		await this.page.goto(path, { waitUntil: 'domcontentloaded' })
		await this.passAgeGateIfPresent()
		await this.unlockPrivateStoreIfPresent()
		await this.page.waitForLoadState('networkidle').catch(() => {})
	}

	private async passAgeGateIfPresent() {
		const isVisible = await this.ageGateChallenge.first().isVisible({ timeout: 3000 }).catch(() => false)

		if (!isVisible) {
			return
		}

		await this.passAgeGateButton.click()
		await expect(this.ageGateChallenge.first()).toBeHidden({ timeout: 10000 })
	}

	private async unlockPrivateStoreIfPresent() {
		const isPasswordVisible = await this.passwordInput.isVisible({ timeout: 2000 }).catch(() => false)

		if (!isPasswordVisible) {
			return
		}

		const password = process.env.CHECKOUT_PASSWORD
		expect(password, 'CHECKOUT_PASSWORD must be set when storefront password gate is visible').toBeTruthy()
		await this.passwordInput.fill(`${password}`)
		await this.passwordInput.press('Enter')
		await expect(this.passwordInput).toBeHidden({ timeout: 10000 })
	}

	private async selectPickupIfPresent() {
		const pickupLabel = this.page.locator('label:has-text("Pickup")').first()
		const isPickupVisible = await pickupLabel.isVisible({ timeout: 2000 }).catch(() => false)

		if (!isPickupVisible) {
			return
		}

		await pickupLabel.click()
		const submitButton = this.page.locator('#fulfillerSubmit, button:has-text("Continue"), button:has-text("Submit")').first()
		const hasSubmitButton = await submitButton.isVisible({ timeout: 2000 }).catch(() => false)

		if (hasSubmitButton) {
			await submitButton.click()
			await this.page.waitForLoadState('networkidle').catch(() => {})
		}
	}

	private async findAddToCartButtonBySku(sku: string) {
		let addButton = this.page.locator(`[data-product_sku="${sku}"], [data-product_sku*="${sku}"]`).first()
		let isVisible = await addButton.isVisible({ timeout: 10000 }).catch(() => false)

		if (isVisible) {
			return addButton
		}

		await this.gotoWithGateHandling('/')
		await this.selectPickupIfPresent()
		addButton = this.page.locator(`[data-product_sku="${sku}"], [data-product_sku*="${sku}"]`).first()
		isVisible = await addButton.isVisible({ timeout: 10000 }).catch(() => false)

		if (!isVisible) {
			throw new Error(`Could not find an add-to-cart control for SKU ${sku} on /shop/ or /`)
		}

		return addButton
	}

	private cartRowByProductName(productName: string) {
		return this.page.locator('.cart_item').filter({ hasText: productName }).first()
	}

	private async acceptCartConflictIfPresent() {
		const conflictModal = this.page.locator('.wpse-drawer[data-module="cart-conflict"]')
		const isVisible = await conflictModal.isVisible({ timeout: 3000 }).catch(() => false)

		if (!isVisible) {
			return
		}

		const startNewCartButton = conflictModal.getByRole('button', { name: /start a new cart/i })
		await expect(startNewCartButton).toBeVisible()
		await startNewCartButton.click()
		await expect(conflictModal).toBeHidden({ timeout: 10000 })
	}

	private async closeCartDrawerIfPresent() {
		const cartDrawer = this.page.locator('#cartDrawer')
		const isVisible = await cartDrawer.isVisible({ timeout: 2000 }).catch(() => false)

		if (!isVisible) {
			return
		}

		const closeButton = this.page
			.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
			.last()
		await expect(closeButton).toBeVisible()
		await closeButton.click()
		await cartDrawer.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
	}
}
