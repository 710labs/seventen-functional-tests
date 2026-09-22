import { expect, Page } from '@playwright/test'
import { HomePageActions } from './homepage-actions.ts'
import {
	getVisibleInsufficientInventoryNotice,
	selectFirstAvailableDeliFlowerPortion,
} from './product-portions.ts'

const liveAuthenticationAddress = '440 Rodeo Drive Beverly Hills'
const liveProductSelector = 'li.product.type-product'

type AddToCartOutcome =
	| { status: 'added' }
	| { reason: string; status: 'low-inventory' | 'timeout' }

type LiveProductCandidate = {
	category: string
	href: string | null
	index: number
	isMedical: boolean
	name: string
}

export class LiveNonProdHomePageActions extends HomePageActions {
	private productListingUrl?: string
	private selectedProductUrl?: string

	override async enterAddress(page: Page, storeType: string, addressParam: string) {
		await this.openAddressSection(page, storeType)
		await this.addressInfoSideBarContainer.waitFor({ state: 'visible' })

		if (!(await this.addressField.isVisible().catch(() => false))) {
			const addNewAddress = this.addressInfoSideBarContainer
				.locator('label:has-text("Add new address")')
				.first()

			await expect(addNewAddress).toBeVisible()
			await addNewAddress.evaluate((element: HTMLElement) => element.click())
			await this.addressField.waitFor({ state: 'visible', timeout: 5000 })
		}

		await expect(this.addressField).toBeVisible()
		await this.addressField.fill(addressParam)
		await page.locator('.pac-item').first().waitFor({ state: 'visible', timeout: 10000 })
		await this.addressField.press('ArrowDown')
		await this.addressField.press('Enter')
		await this.submitAddress(page)
	}

	override async addSingleProductToCart(page: Page) {
		const firstProduct = page.locator(liveProductSelector).first()
		let productsAreVisible = await firstProduct.isVisible().catch(() => false)

		if (!productsAreVisible) {
			productsAreVisible = await firstProduct
				.waitFor({ state: 'visible', timeout: 5000 })
				.then(() => true)
				.catch(() => false)
		}

		if (!productsAreVisible) {
			await this.enterAddress(page, 'live', liveAuthenticationAddress)
			await firstProduct.waitFor({ state: 'visible', timeout: 15000 })
		}

		this.productListingUrl = page.url()
		await super.addSingleProductToCart(page)
		this.selectedProductUrl = page.url()
	}

	private normalizeUrl(rawUrl: string, baseUrl = this.page.url()) {
		try {
			const url = new URL(rawUrl, baseUrl)
			url.search = ''
			url.hash = ''
			return url.href
		} catch {
			return rawUrl
		}
	}

	private parseCartItemCount(values: Array<string | null | undefined>) {
		for (const value of values) {
			if (!value) {
				continue
			}

			const normalizedValue = value.replace(/\s+/g, ' ').trim()
			const countMatch =
				normalizedValue.match(/\((\d+)\)/) ||
				normalizedValue.match(/\b(?:cart|bag)\D{0,12}(\d+)\b/i) ||
				normalizedValue.match(/^(\d+)\s*(?:items?)?$/i)

			if (countMatch) {
				return Number.parseInt(countMatch[1], 10)
			}
		}

		return null
	}

	private async cartItemCount(page: Page) {
		const cartToggles = page.locator('a.wpse-cart-openerize')
		const cartToggleCount = await cartToggles.count()
		const fallbackCounts: number[] = []

		for (let index = 0; index < cartToggleCount; index += 1) {
			const cartToggle = cartToggles.nth(index)
			const values = await cartToggle
				.evaluate(element => [
					element.textContent,
					element.getAttribute('aria-label'),
					element.getAttribute('title'),
					element.getAttribute('data-count'),
					element.getAttribute('data-cart-count'),
					element.getAttribute('data-item-count'),
				])
				.catch(() => [])
			const parsedCount = this.parseCartItemCount(values)

			if (parsedCount === null) {
				continue
			}

			if (await cartToggle.isVisible().catch(() => false)) {
				return parsedCount
			}

			fallbackCounts.push(parsedCount)
		}

		if (fallbackCounts.length > 0) {
			return Math.max(...fallbackCounts)
		}

		return 0
	}

	private async cartDrawerContainsProduct(productName: string) {
		if (!(await this.cartDrawerContainer.isVisible().catch(() => false))) {
			return false
		}

		const drawerText = ((await this.cartDrawerContainer.textContent().catch(() => '')) || '')
			.replace(/\s+/g, ' ')
			.trim()
			.toLowerCase()
		const normalizedProductName = productName.replace(/\s+/g, ' ').trim().toLowerCase()

		return Boolean(normalizedProductName && drawerText.includes(normalizedProductName))
	}

	private async waitForAddToCartOutcome(
		page: Page,
		productName: string,
		initialCartCount: number,
	): Promise<AddToCartOutcome> {
		const deadline = Date.now() + 10000

		while (Date.now() < deadline) {
			const inventoryNotice = await getVisibleInsufficientInventoryNotice(page)

			if (inventoryNotice) {
				return { reason: inventoryNotice, status: 'low-inventory' }
			}

			const currentCartCount = await this.cartItemCount(page)

			if (
				currentCartCount > initialCartCount ||
				(await this.cartDrawerContainsProduct(productName))
			) {
				return { status: 'added' }
			}

			await page.waitForTimeout(200)
		}

		return {
			reason: [
				`No cart confirmation appeared within 10 seconds for "${productName}".`,
				`Cart count before: ${initialCartCount}; after: ${await this.cartItemCount(page)}.`,
				`Current URL: ${page.url()}`,
			].join(' '),
			status: 'timeout',
		}
	}

	private async returnToProductListing(page: Page) {
		if (this.productListingUrl) {
			await page.goto(this.productListingUrl, { waitUntil: 'domcontentloaded' })
		} else {
			const previousPage = await page.goBack({ waitUntil: 'domcontentloaded' })

			if (!previousPage) {
				throw new Error(
					`Unable to return to the Live product listing after an inventory rejection at ${page.url()}`,
				)
			}
		}

		await page.locator(liveProductSelector).first().waitFor({ state: 'visible', timeout: 15000 })
		await page.waitForLoadState('networkidle').catch(() => {})
		this.productListingUrl = page.url()
	}

	private async readProductCandidates(page: Page): Promise<LiveProductCandidate[]> {
		return page.locator(liveProductSelector).evaluateAll(nodes =>
			nodes.map((product, index) => ({
				category:
					product
						.querySelector('.product-subheading')
						?.textContent?.replace(/\s+/g, ' ')
						.trim() || '',
				href:
					product.querySelector<HTMLAnchorElement>('.woocommerce-loop-product__link')?.href ||
					null,
				index,
				isMedical: Boolean(product.querySelector('.wpse-metabadge.med-metabadge')),
				name:
					product
						.querySelector('.woocommerce-loop-product__title')
						?.textContent?.replace(/\s+/g, ' ')
						.trim() || `product at index ${index}`,
			})),
		)
	}

	private async addNextProductAfterInventoryRejection(
		page: Page,
		failedProductName: string,
		failedProductCategory: string,
		failedProductUrl: string,
		initialRejection: string,
	) {
		await this.returnToProductListing(page)

		const candidates = await this.readProductCandidates(page)
		const normalizedFailedUrl = this.normalizeUrl(failedProductUrl)
		const failedCandidate = candidates.find(
			candidate => candidate.href && this.normalizeUrl(candidate.href) === normalizedFailedUrl,
		)
		const startIndex = failedCandidate ? failedCandidate.index + 1 : 1
		const requireDeliFlower = failedProductCategory.trim().toLowerCase() === 'deli flower'
		const rejectionReasons = [`${failedProductName}: ${initialRejection}`]

		for (const candidate of candidates) {
			if (
				candidate.index < startIndex ||
				candidate.isMedical ||
				!candidate.href ||
				this.normalizeUrl(candidate.href) === normalizedFailedUrl ||
				(requireDeliFlower && candidate.category.trim().toLowerCase() !== 'deli flower')
			) {
				continue
			}

			console.log(
				`Trying next Deli Flower product "${candidate.name}" (index ${candidate.index}) after an inventory rejection.`,
			)
			await page.goto(candidate.href, { waitUntil: 'domcontentloaded' })

			const productSummary = page.locator('.summary.entry-summary').first()
			await expect(productSummary).toBeVisible()
			const productName =
				(await productSummary.locator('h1.product_title, h1.entry-title').first().textContent())
					?.replace(/\s+/g, ' ')
					.trim() || candidate.name
			const addToCart = productSummary
				.getByRole('button', { name: /^add to cart$/i })
				.first()

			await expect(addToCart).toBeVisible()

			try {
				await selectFirstAvailableDeliFlowerPortion(page, addToCart, productName)
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error)
				rejectionReasons.push(`${productName}: ${reason}`)
				continue
			}

			const initialCartCount = await this.cartItemCount(page)
			await addToCart.click()
			const outcome = await this.waitForAddToCartOutcome(page, productName, initialCartCount)

			if (outcome.status === 'added') {
				this.selectedProductUrl = page.url()
				console.log(`Added replacement Deli Flower product "${productName}" after registration.`)
				return
			}

			if (outcome.status === 'low-inventory') {
				rejectionReasons.push(`${productName}: ${outcome.reason}`)
				continue
			}

			throw new Error(outcome.reason)
		}

		throw new Error(
			[
				'Unable to add a replacement Deli Flower product after exhausting the remaining candidates.',
				...rejectionReasons,
			].join('\n'),
		)
	}

	async addCurrentProductToCartAfterRegistration(page: Page) {
		const productSummary = page.locator('.summary.entry-summary').first()
		await expect(productSummary).toBeVisible()

		const productName =
			(await productSummary.locator('h1.product_title, h1.entry-title').first().textContent())
				?.replace(/\s+/g, ' ')
				.trim() || 'current product'
		const productCategoryLabel = productSummary.locator('.product-subheading').first()
		const productCategory =
			(await productCategoryLabel.count()) > 0
				? ((await productCategoryLabel.textContent()) || '').replace(/\s+/g, ' ').trim()
				: ''
		const productUrl = this.selectedProductUrl || page.url()
		const cartItemCount = await this.cartItemCount(page)

		if (cartItemCount > 0) {
			console.log(
				`Cart retained ${cartItemCount} item(s) after registration; skipping the product re-add.`,
			)
			return
		}

		const existingInventoryNotice = await getVisibleInsufficientInventoryNotice(page)

		if (existingInventoryNotice) {
			await this.addNextProductAfterInventoryRejection(
				page,
				productName,
				productCategory,
				productUrl,
				existingInventoryNotice,
			)
			return
		}

		const addToCart = productSummary
			.getByRole('button', { name: /^add to cart$/i })
			.first()

		await expect(addToCart).toBeVisible()
		await selectFirstAvailableDeliFlowerPortion(
			page,
			addToCart,
			productName,
		)
		const initialCartCount = await this.cartItemCount(page)
		await addToCart.click()
		const outcome = await this.waitForAddToCartOutcome(page, productName, initialCartCount)

		if (outcome.status === 'low-inventory') {
			await this.addNextProductAfterInventoryRejection(
				page,
				productName,
				productCategory,
				productUrl,
				outcome.reason,
			)
			return
		}

		if (outcome.status === 'timeout') {
			throw new Error(outcome.reason)
		}

		console.log(`Re-added product "${productName}" after registration.`)
	}
}
