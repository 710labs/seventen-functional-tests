import test, { Page, TestInfo, Locator, expect } from '@playwright/test'
import { calculateCartTotals, formatNumbers } from '../utils/order-calculations'
import { QAClient } from '../support/qa/client'
import { type TestUsageType } from '../utils/usage-types'
import { moneyInCents, verifyOrderPricing, type ExpectedOrderPricing, type ExpectedDiscountLine } from './components/order-pricing'

export class CartPage {
	page: Page
	browserName: any
	workerInfo: TestInfo
	checkoutButton: Locator
	recLimitWarning: Locator
	conditionalityToggle: Locator
	conditionalCheckoutButton: Locator
	cartItems: any[]
	cartTotal: any
	usageType: TestUsageType
	qaClient: QAClient
	cartCounter:Locator

	constructor(
		page: Page,
		qaClient: QAClient,
		browserName: any,
		workerInfo: TestInfo,
		usageType: TestUsageType,
	) {
		this.page = page
		this.browserName = browserName
		this.workerInfo = workerInfo
		this.checkoutButton = this.page.locator('.checkout-button')
		this.recLimitWarning = this.page.locator('.medonly-issue')
		this.conditionalityToggle = this.page.locator('#conditionality')
		this.conditionalCheckoutButton = this.page.locator('.conditional-checkout-button')
		this.cartItems = new Array()
		this.usageType = usageType
		this.qaClient = qaClient
		this.cartCounter = this.page.locator('.rsp-countdown-content')
	}

	async goToCheckout() {
		await test.step('Proceed to Checkout', async () => {
			const checkoutButton = await this.waitForCheckoutButton()
			await checkoutButton.click()
		})
	}

	productRow(productId: number) {
		if (!Number.isSafeInteger(productId) || productId <= 0) throw new Error('Invalid product ID')
		return this.page.locator('.woocommerce-cart-form .cart_item').filter({
			has: this.page.locator(`[data-product_id="${productId}"]`),
		})
	}

	async getProductQuantity(productId: number): Promise<number> {
		const row = this.productRow(productId)
		if (await row.count() === 0) return 0
		await expect(row).toHaveCount(1)
		const quantity = Number(await row.locator('input.qty').inputValue())
		if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error(`Invalid cart quantity for product ${productId}`)
		return quantity
	}

	async verifyProductQuantity(productId: number, quantity: number) {
		await test.step(`Verify product ${productId} has ${quantity} units in the cart`, async () => {
			const row = this.productRow(productId)
			await expect(row, `Cart must contain product ID ${productId}`).toHaveCount(1)
			await expect(row.locator('input.qty')).toHaveValue(String(quantity))
		})
	}

	async setProductQuantity(productId: number, quantity: number) {
		if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error('Quantity must be a positive integer')
		await test.step(`Set cart product ${productId} quantity to ${quantity}`, async () => {
			const row = this.productRow(productId)
			await expect(row).toHaveCount(1)
			const input = row.locator('input.qty')
			await input.fill(String(quantity))
			await input.dispatchEvent('change')
			const update = this.page.locator('[name="update_cart"]')
			if (await update.isVisible() && await update.isEnabled()) await update.click()
			await expect(this.page.locator('.woocommerce-cart-form .blockUI')).toHaveCount(0)
			await expect(input).toHaveValue(String(quantity))
		})
	}

	async removeProduct(productId: number) {
		await test.step(`Remove cart product ${productId}`, async () => {
			const row = this.productRow(productId)
			await expect(row).toHaveCount(1)
			await row.locator('.product-remove a').click()
			await expect(row).toHaveCount(0)
		})
	}

	async verifyDiscountPricing(expected: ExpectedOrderPricing) {
		await test.step('Verify cart discount lines, taxes and total', async () => {
			const summary = this.page.locator('.cart_totals:visible')
			const bulkLines = expected.discountLines.filter(line => line.categoryId !== undefined)
			await expect(summary.locator('tr.svntn-wdr-section')).toHaveCount(bulkLines.length ? 1 : 0)
			if (bulkLines.length) await expect(summary.locator('tr.svntn-wdr-section th')).toHaveText('List member pricing', { ignoreCase: true })
			await expect(summary.locator('tr.cart-discount.svntn-wdr-row')).toHaveCount(bulkLines.length)
			await verifyOrderPricing(summary, expected)
		})
	}

	async verifyProductDiscountTags(
		lines: { productId: number; categoryIds: number[]; isFreeBogoUnit?: boolean }[],
		discounts: ExpectedDiscountLine[],
	) {
		await test.step('Verify category tier badges on each cart product', async () => {
			for (const line of lines) {
				const expected = line.isFreeBogoUnit ? [] : discounts.filter(discount =>
					discount.categoryId !== undefined && line.categoryIds.includes(discount.categoryId))
				const row = this.productRow(line.productId)
				await expect(row).toHaveCount(1)
				const tags = row.locator('.svntn-wdr-tag')
				await expect(tags, `Product ${line.productId}: only the active category tier should be shown`).toHaveCount(expected.length)
				for (const [index, discount] of expected.entries()) {
					await expect(tags.nth(index)).toBeVisible()
					await expect(tags.nth(index)).toHaveText(discount.label)
					if (discount.couponKey) await expect(tags.nth(index)).toHaveAttribute('data-wdr-coupon', discount.couponKey)
				}
			}
		})
	}

	async verifyProductQuantities(lines: { productId: number; qty: number; unitPrice: string }[]) {
		await test.step('Verify cart quantities and undiscounted unit prices', async () => {
			await expect(this.page.locator('.woocommerce-cart-form .cart_item')).toHaveCount(lines.length)
			for (const line of lines) {
				const row = this.productRow(line.productId)
				await this.verifyProductQuantity(line.productId, line.qty)
				expect(moneyInCents(await row.locator('.product-price .amount').first().innerText())).toBe(Math.round(Number(line.unitPrice) * 100))
			}
		})
	}

	async verifyEmpty() {
		await expect(this.page.locator('.woocommerce-cart-form .cart_item')).toHaveCount(0)
		await expect(this.page.locator('.cart_totals:visible tr.cart-discount')).toHaveCount(0)
	}

	private async handleRecreationalLimit(): Promise<Locator | null> {
		const warning = this.recLimitWarning.first()
		const limitHit = await warning.isVisible()

		if (!limitHit) {
			return null
		}

		return await test.step('Bypass recreational limit', async () => {
			const continueButton = this.conditionalCheckoutButton.first()
			await this.conditionalityToggle.check()
			await continueButton.waitFor({ state: 'visible', timeout: 10_000 })
			return continueButton
		})
	}

	private async waitForCheckoutButton(): Promise<Locator> {
		const conditionalButton = await this.handleRecreationalLimit()
		if (conditionalButton) {
			return conditionalButton
		}

		const checkoutButton = this.checkoutButton.first()
		const isVisible = await checkoutButton
			.waitFor({ state: 'visible', timeout: 10_000 })
			.then(() => true)
			.catch(() => false)

		if (isVisible) {
			return checkoutButton
		}

		const cartItemCount = await this.page.locator('.cart_item').count().catch(() => 0)
		const bodyText = await this.page
			.locator('body')
			.innerText({ timeout: 1000 })
			.catch(() => '')
		const bodyPreview = bodyText.replace(/\s+/g, ' ').trim().slice(0, 500)

		throw new Error(
			[
				'Checkout button was not visible before proceeding to checkout.',
				`Current URL: ${this.page.url()}`,
				`Cart item count: ${cartItemCount}`,
				`Body preview: ${bodyPreview}`,
			].join('\n'),
		)
	}

	async verifyCart(zipcode: string): Promise<any> {
		if (process.env.BYPASS_TAX_CALC === 'true') {
			await test.step('Proceed to Checkout', async () => {
				const checkoutButton = await this.waitForCheckoutButton()
				await checkoutButton.click()
			})
			return this.cartItems
		}

		await test.step('Verify Cart Totals', async () => {
			//Get Tax Rates
			var taxRates: any

			taxRates = await this.qaClient.getRates({ post_code: zipcode })

			//Get ProductItem Info
			await this.page.waitForSelector('.cart_item')

			const productRows = await this.page.locator('.cart_item').elementHandles()
			await expect(productRows, 'Could not find any products in cart').not.toBeNull()

			for (let i = 0; i < productRows.length; i++) {
				var unitPrice = await (await productRows[i].$('.product-price >> bdi')).innerHTML()
				unitPrice = await formatNumbers(unitPrice)
				if (unitPrice == '0.00') {
					continue
				}
				var quanity = await (await productRows[i].$('.qty')).inputValue()
				var amount = await formatNumbers(
					await (await productRows[i].$('.product-subtotal >> bdi')).innerHTML(),
				)
				var name = await (await productRows[i].$('.product-name >> a')).innerHTML()
				name = name.replace(/\#/g, '%23')
				name = name.replace(/\+/g, '%2B')

				var idElement = await productRows[i].$('.product-remove >> a')

				var productId = await idElement.getAttribute('data-product_id')

				const product = await this.qaClient.getProduct({ product_id: productId || undefined })

				var id = product.id
				var sku = product.sku
				var taxClass = product.tax_class
				this.cartItems.push({
					id,
					name,
					sku,
					unitPrice,
					taxClass,
					quanity,
					subTotal: amount,
				})
			}
		})
		await test.step('Confirm Cart + Proceed to Checkout', async () => {
			const checkoutButton = await this.waitForCheckoutButton()
			await checkoutButton.click()
		})
		expect(this.cartItems).not.toBeNull()

		return this.cartItems
	}

	async verifyCredit(existingAccountCredit: number): Promise<any> {
		var accountCredit: string = ''
		await test.step('Verify Cart Summary', async () => {
			//Get Cart Summary Info
			const taxSummaries = await this.page.locator('.tax-rate').elementHandles()
			const accountCreditElement = await this.page.locator('.cart-discount').elementHandle()
			accountCredit = await formatNumbers(
				await (await accountCreditElement.$('.amount')).innerHTML(),
			)

			await expect(accountCredit, 'Account Credit was not applied to order.').not.toBeNull()
			await expect(
				taxSummaries,
				'Taxes not applied to order with Account Credit applied.',
			).not.toBeNull()
			await expect(
				Math.floor(accountCredit),
				'Credit amount applied to cart is higher than client credit on account.',
			).toBeLessThanOrEqual(existingAccountCredit)
		})
	}
}
