require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

// Deduplicated logger to prevent duplicate console logs from multiple test workers
const loggedMessages = new Set<string>()
const LOG_CACHE_DURATION = 1000 // Clear cache after 1 second

function debugLog(message: string) {
	const key = `${Date.now()}-${message}`
	const approximateKey = message.substring(0, 100) // Use first 100 chars as approximate key

	// Check if we've logged this message recently
	if (!loggedMessages.has(approximateKey)) {
		loggedMessages.add(approximateKey)
		console.log(message)

		// Clear old entries after a delay
		setTimeout(() => {
			loggedMessages.delete(approximateKey)
		}, LOG_CACHE_DURATION)
	}
}

export class HomePageActions {
	readonly page: Page
	readonly URL: String
	readonly pageTitleSelector: Locator
	readonly homePageButton710: Locator
	readonly accountButtonNav: Locator
	readonly cartButtonNav: Locator
	readonly addToCartButtonGeneral: Locator
	readonly enterAddressButtonDesktop: Locator
	readonly enterAddressButtonMobile: Locator
	readonly enterAddressButtonConciergeDesktop: Locator
	readonly enterAddressButtonConciergeMobile: Locator
	readonly addressInfoSideBarContainer: Locator
	readonly addressField: Locator
	readonly submitAddressButton: Locator
	readonly cartDrawerContainer: Locator
	readonly closeCartDrawerButton: Locator
	readonly closeCartButtonGeneric: Locator

	readonly minimumNotMetLabel: Locator
	readonly continueToCheckoutButton: Locator
	readonly medicalOnlyBanner: Locator
	readonly medicalCardCheckbox: Locator
	readonly medCardFileInput: Locator
	readonly issuingStateSelect: Locator
	readonly expirationInput: Locator
	readonly productPageAddToCartButton: Locator
	readonly cartContinueShoppingButton: Locator
	readonly liveViewCartCheckout: Locator
	readonly liveChangeAddressButton: Locator
	readonly liveCartTitle: Locator
	readonly medCartCheckoutButton: Locator
	readonly viewCartButtonSimple: Locator
	constructor(page: Page) {
		this.page = page
		const URL = process.env.ALWAYS_ON_URL || ''
		this.pageTitleSelector = page.locator('span.site-header-group')
		this.homePageButton710 = page.locator('a[rel="home"] h1.site-title')
		this.accountButtonNav = page.locator('svg.icon.icon-account')
		this.cartButtonNav = page.locator('a.wpse-cart-openerize').first()
		this.addToCartButtonGeneral = page.locator('button[aria-label="Add product to cart"]')
		this.enterAddressButtonDesktop = page.locator('a.wpse-button-storenav.wpse-openerize').first()
		this.enterAddressButtonMobile = page.locator('a.wpse-button-storenav.wpse-openerize').nth(1)
		this.enterAddressButtonConciergeDesktop = page.locator('a[data-module="fulfillment"]').first()
		this.enterAddressButtonConciergeMobile = page
			.locator('.wpse-button-storenav.wpse-openerize')
			.nth(1)
		this.addressInfoSideBarContainer = page.locator('div.wpse-drawer[data-module="fulfillment"]')
		this.addressField = page.locator('#fasd_address')
		this.submitAddressButton = page.locator('button.wpse-button-primary.fasd-form-submit').first()
		this.cartDrawerContainer = page.locator('#cartDrawer')
		this.closeCartDrawerButton = page
			.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
			.nth(1)
		this.closeCartButtonGeneric = page.locator(
			'button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer',
		)
		this.minimumNotMetLabel = page.locator('div.wpse-snacktoast').first()
		this.continueToCheckoutButton = page.locator('a.checkout-button.button.alt.wc-forward')
		this.productPageAddToCartButton = page.locator('button.wpse-button-primary.fasd_to_cart')
		this.cartContinueShoppingButton = page.locator('a:has-text("Add more items")')
		this.liveViewCartCheckout = page.locator('a:has-text("View cart and checkout")')
		this.liveChangeAddressButton = page.locator('span.fasd-nested-unrollable')
		this.liveCartTitle = page.locator('h6:has-text("Your cart from")')
		this.medCartCheckoutButton = page.locator('a.checkout-button.button.alt.wc-forward')
		this.viewCartButtonSimple = page.locator(
			'a.button.wpse-button-primary.wpse-cart-openerize[data-shape="drawer"][data-module="cart"][href="/cart"]',
		)
		this.medicalOnlyBanner = page.locator('.wpse-snacktoast.warn-toast.med-issue')
		this.issuingStateSelect = page.locator('#medcard_state')
		this.expirationInput = page.locator('input#medcard_exp')
	}
	async openAddressSection(page: Page, storeType: string) {
		const viewportSize = page.viewportSize()
		const width = viewportSize?.width ?? 1024
		if (storeType === 'concierge') {
			if (width <= 768) {
				// Mobile view Concierge
				await this.enterAddressButtonConciergeMobile.waitFor({ state: 'visible' })
				await expect(this.enterAddressButtonConciergeMobile).toBeVisible()
				await this.enterAddressButtonConciergeMobile.click()
				// Check if the button is visible
				if (await this.submitAddressButton.isVisible()) {
					// Click the button if it's visible
					console.log('Address drawer opened. Dont need to click Address button again.')
				} else {
					await this.enterAddressButtonConciergeMobile.click()
					console.log('Click address button again')
				}
			} else {
				// Desktop view Concierge
				await this.enterAddressButtonConciergeDesktop.waitFor({ state: 'visible' })
				await expect(this.enterAddressButtonConciergeDesktop).toBeVisible()
				await this.enterAddressButtonConciergeDesktop.click()
				// Check if the button is visible
				if (await this.submitAddressButton.isVisible()) {
					// Click the button if it's visible
					console.log('Address drawer opened. Dont need to click Address button again.')
				} else {
					await this.enterAddressButtonConciergeDesktop.click()
					console.log('Click address button again')
				}
			}
		} else if (storeType === 'live') {
			if (width <= 768) {
				// Mobile view
				await this.enterAddressButtonMobile.waitFor({ state: 'visible' })
				await expect(this.enterAddressButtonMobile).toBeVisible()
				await this.enterAddressButtonMobile.click()
				// Check if the button is visible
				if (await this.submitAddressButton.isVisible()) {
					// Click the button if it's visible
					console.log('Address drawer opened. Dont need to click Address button again.')
				} else {
					await this.enterAddressButtonMobile.click()
					console.log('Click address button again')
				}
			} else {
				// Desktop view
				await this.enterAddressButtonDesktop.waitFor({ state: 'visible' })
				await expect(this.enterAddressButtonDesktop).toBeVisible()
				await this.enterAddressButtonDesktop.click()
				// Check if the button is visible
				if (await this.submitAddressButton.isVisible()) {
					// Click the button if it's visible
					console.log('Address drawer opened. Dont need to click Address button again.')
				} else {
					await this.enterAddressButtonDesktop.click()
					console.log('Click address button again')
				}
			}
		}
	}
	async openConciergeAddress(page: Page) {
		const viewportSize = page.viewportSize()
		const width = viewportSize?.width ?? 1024
		if (width <= 768) {
			// Mobile view Concierge
			await this.enterAddressButtonConciergeMobile.waitFor({ state: 'visible' })
			await expect(this.enterAddressButtonConciergeMobile).toBeVisible()
			await this.enterAddressButtonConciergeMobile.click()
			// Check if the button is visible
			if (await this.submitAddressButton.isVisible()) {
				// Click the button if it's visible
				console.log('Address drawer opened. Dont need to click Address button again.')
			} else {
				await this.enterAddressButtonConciergeMobile.click()
				console.log('Click address button again')
			}
		} else {
			// Desktop view Concierge
			await this.enterAddressButtonConciergeDesktop.waitFor({ state: 'visible' })
			await expect(this.enterAddressButtonConciergeDesktop).toBeVisible()
			await this.enterAddressButtonConciergeDesktop.click()
			// Check if the button is visible
			if (await this.submitAddressButton.isVisible()) {
				// Click the button if it's visible
				console.log('Address drawer opened. Dont need to click Address button again.')
			} else {
				await this.enterAddressButtonConciergeDesktop.click()
				console.log('Click address button again')
			}
		}
	}
	async goToHomePage() {
		await this.homePageButton710.waitFor({ state: 'visible' })
		await expect(this.homePageButton710).toBeVisible()
		await this.homePageButton710.click()
	}
	async submitAddress(page: Page) {
		await this.page.waitForTimeout(1500)
		await expect(this.submitAddressButton).toBeVisible()
		// Submitting address may trigger a full page navigation/reload (e.g. store switch).
		// We wrap the click with waitForLoadState to handle the navigation gracefully
		// and prevent a "Target page, context or browser has been closed" error.
		await Promise.all([
			this.page.waitForLoadState('load'),
			this.submitAddressButton.click(),
		])
		await this.page.waitForTimeout(2000)
	}
	async enterAddress(page: Page, storeType: string, addressParam: string) {
		await test.step('Click address button', async () => {
			await this.openAddressSection(page, storeType)
		})
		await test.step('Enter address info into field', async () => {
			//verify address sidebar container AND address field are visible
			await this.addressInfoSideBarContainer.waitFor({ state: 'visible' })
			await expect(this.addressInfoSideBarContainer).toBeVisible()
			await expect(this.addressField).toBeVisible()

			const address = addressParam
			// Type the address into the text field
			await this.addressField.fill(address)

			// Wait for the autocomplete suggestions to appear
			await this.page.waitForSelector('.pac-item') // Replace with the actual class or selector of the autocomplete suggestion items

			// Press 'ArrowDown' to navigate to the first suggestion and then press 'Enter' to select it
			await this.addressField.press('ArrowDown')
			await this.addressField.press('Enter')
		})
		await test.step('Click submit button', async () => {
			await this.submitAddress(page)
		})
	}
	async selectAddressFromList(page: Page, storeType: string, addressToSelect: string) {
		await test.step('Select Address', async () => {
			// Locate a label containing the address text
			const addressLabel = page.locator('#render_useraddress_component .fasd-radio-item label', {
				hasText: addressToSelect,
			})

			// Inside this label, we have an <input type="radio"> to click
			const radioInput = addressLabel.locator('input[type="radio"]')

			// Check (select) the radio button
			await radioInput.check()

			// Optional: confirm it was checked
			await expect(radioInput).toBeChecked()

			console.log(`Selected address: "${addressToSelect}"`)
		})
		await test.step('Click submit button', async () => {
			await this.submitAddress(page)
		})
	}
	async randomizeCartItems() {
		return Math.random() * (2 - -2 + -2)
	}

	async goToCheckout() {
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}
	async openCart() {
		// Only open the cart if it's not already visible
		// if (await this.cartDrawerContainer.isVisible()) {
		// 	console.log('Cart is already open.')
		// 	return
		// }
		// View the cart
		await this.cartButtonNav.click()
		await this.page.waitForTimeout(2000)
		await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })
	}
	async closeCart() {
		// Close the cart drawer and wait before adding product
		await this.closeCartButtonGeneric.first().evaluate(el => (el as HTMLElement).click())
		await this.page.waitForTimeout(2000)
	}
	async clearProductsFromCart(page: Page) {
		await this.page.waitForTimeout(2000)

		// Robust loop to clear cart
		let loopCount = 0
		const MAX_LOOPS = 20 // Safety break

		while (loopCount < MAX_LOOPS) {
			loopCount++

			// 1. Open the cart (BLINDLY)
			// User reports that `isVisible` is unreliable for this drawer.
			// We know the cart closes after removal, so we must re-open it unconditionally.
			console.log(`[Loop ${loopCount}] Opening cart to ensure visibility...`)
			await this.openCart()

			// 2. Refresh the list of items
			await page.waitForTimeout(1000) // Wait for cart stability

			// Check if "Empty" text is visible first - if so, we are done
			const nothingInCart = page.locator('#radicalCartLayout.empty-radical-cart')
			const emptyText = this.cartDrawerContainer.getByText(/You have nothing in your bag/i)
			
			if ((await nothingInCart.isVisible()) || (await emptyText.isVisible())) {
				console.log('Cart displays empty state. Stopping.')
				break
			}

			let cartRows = page.locator('tr.woocommerce-cart-form__cart-item')
			let rowCount = await cartRows.count()

			console.log(`[Loop ${loopCount}] Checking cart: found ${rowCount} items.`)

			// 3. Exit condition
			if (rowCount === 0) {
				console.log('No items found in cart rows. Stopping.')
				break
			}

			// 4. Remove the first item
			console.log(`Removing item 1 of ${rowCount}...`)
			// const firstRow = cartRows.first()
			// const removeLink = firstRow.locator('td.product-remove .remove')
			const removeLink = page.locator('td.product-remove .remove').first()

			// Click remove - use evaluate because the element might be technically hidden/overlapped
			// but still functional int he DOM
			await removeLink.evaluate((el: HTMLElement) => el.click())

			// 5. Wait for cart to close or stabilize
			// User stated: "remove item which closes cart automatically"
			// So we expect the drawer to disappear.
			// await this.cartDrawerContainer.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
			// 	console.log('Cart did not auto-close within 5s, proceeding anyway...')
			// })

			// Small pause before next iteration
			await page.waitForTimeout(1000)
		}

		if (loopCount >= MAX_LOOPS) {
			console.warn(`WARNING: Exceeded ${MAX_LOOPS} attempts to clear cart. Check logic.`)
		}

		console.log('Cart is cleared. Closing cart...')
		if (await this.cartDrawerContainer.isVisible()) {
			await this.closeCart()
		}
	}
	async addProductsToCart(page: Page, numberOfItems: number) {
		// Get all the products on the page
		const products = await page.locator('ul.products li.product')

		// Loop through the specified number of items
		for (let i = 0; i < numberOfItems; i++) {
			// Check if there are enough products to add
			if (i >= (await products.count())) {
				console.log(`Only ${await products.count()} products available on the page.`)
				break
			}

			// Get the 'Add to Cart' button and product name for the current product
			const product = products.nth(i)
			const addToCartButton = product.locator('button.add_to_cart_button')
			const productName = await product.locator('.woocommerce-loop-product__title').innerText()

			// Click the 'Add to Cart' button
			await addToCartButton.click()
			await page.waitForTimeout(4000) // Adjust this timeout based on your app's behavior

			// Wait for the cartDrawer to become visible
			await page.waitForSelector('#cartDrawer', { state: 'visible' })

			// Verify that the product was added to the cart by checking the cartDrawer
			const cartItem = await page.locator(
				`#cartDrawer .woocommerce-cart-form__cart-item .product-name a:has-text("${productName}")`,
			)
			const isProductInCart = (await cartItem.count()) > 0

			if (!isProductInCart) {
				throw new Error(`Product "${productName}" was not found in the cart after being added.`)
			}

			console.log(`Product "${productName}" was successfully added to the cart.`)

			// Close the cartDrawer
			await this.closeCartDrawerButton.click()

			// Wait for the cartDrawer to be hidden again
			//await page.waitForSelector('#cartDrawer', { state: 'hidden' })

			// Optionally, wait before adding the next product to account for any animations or delays
			await page.waitForTimeout(1000) // Adjust this timeout based on your app's behavior
		}
	}
	async goToAccountPage(page: Page) {
		await this.accountButtonNav.waitFor({ state: 'visible' })
		await expect(this.accountButtonNav).toBeVisible()
		await this.accountButtonNav.click({ force: true })
	}

	async addUntilMinimumMet(page: Page, { shouldAddProduct, onMinimumReached, startIndex = 4 }: { shouldAddProduct: (productEl: Locator) => Promise<boolean>; onMinimumReached: () => Promise<void>; startIndex?: number }) {
		// Wait for dynamically-rendered products to appear in the DOM
		debugLog('Waiting for product elements to render...')
		await page.waitForSelector('li.product.type-product.product-type-simple.status-publish', {
			state: 'visible',
			timeout: 15000,
		})
		await page.waitForTimeout(2000) // Extra buffer for remaining products to finish rendering

		// Unified product locator - using specific selector pattern
		const products = await page.locator(
			'li.product.type-product.product-type-simple.status-publish',
		)
		let i = startIndex
		const total = await products.count()

		// DEBUG: Log phase 2 start
		debugLog('=== ADD UNTIL MINIMUM MET (Phase 2) ===')
		debugLog(`Starting at index: ${i}, Total products: ${total}`)

		while (i < total) {
			const product = products.nth(i)

			// Scroll into view for visibility
			await product.scrollIntoViewIfNeeded()
			await page.waitForTimeout(200)

			// Decide whether to add this product
			const wantThis = await shouldAddProduct(product)
			if (!wantThis) {
				i++
				continue
			}

			// Click "Add to Cart"
			const addBtn = product.locator('button.button.product_type_simple.fasd_to_cart.ajax_groove')
			const name = (await product.locator('.woocommerce-loop-product__title').innerText()).trim()

			// DEBUG: Log add attempt
			debugLog(`[${i}] Attempting to add "${name}" to cart...`)
			const btnVisible = await addBtn.isVisible().catch(() => false)
			debugLog(`  Add button visible: ${btnVisible}`)

			await expect(addBtn).toBeVisible()
			await addBtn.click()
			debugLog(`  Clicked "Add to Cart" for "${name}"`)

			// Check for "Start a new cart" modal
			try {
				const conflictModal = page.locator('.wpse-drawer[data-module="cart-conflict"]')
				// Short timeout for modal appearance
				await conflictModal.waitFor({ state: 'visible', timeout: 5000 })
				
				if (await conflictModal.isVisible()) {
					debugLog('Cart conflict modal detected in addUntilMinimumMet. Attempting to start a new cart.')
					const startNewCartBtn = conflictModal.locator('button:has-text("Start a new cart")') 
					
					await expect(startNewCartBtn).toBeVisible()
					await startNewCartBtn.click()
					debugLog('Clicked "Start a new cart".')
					
					// Wait for modal to disappear
					await conflictModal.waitFor({ state: 'hidden', timeout: 10000 })
				}
			} catch (e) {
				// Ignore timeout if modal doesn't appear
			}

			// Wait for the drawer, then verify item is in cart
			await page.waitForTimeout(3000)
			await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })

			const cartItemLocator = page.locator(`td.product-name:has(a:has-text("${name}"))`)
			if ((await cartItemLocator.count()) === 0) {
				throw new Error(`Product "${name}" was not found in the cart after being added.`)
			}
			debugLog(`  ✓ "${name}" added to cart successfully`)

			// Check if the "minimum not met" banner is still visible
			const stillNeedsMore = await this.minimumNotMetLabel.isVisible()
			debugLog(`  Minimum still needed: ${stillNeedsMore}`)

			if (stillNeedsMore) {
				// Close drawer and continue to next product
				await this.closeCartDrawerButton.click()
				await page.waitForTimeout(2000)
				i++
				continue
			}

			// Minimum reached → invoke the callback
			debugLog('=== MINIMUM REACHED - Proceeding to checkout ===')
			await onMinimumReached()
			return
		}

		// If we exit the loop without meeting minimum:
		debugLog(
			`=== WARNING: Reached end of product list (count = ${total}) without meeting the minimum. ===`,
		)
	}

	/**
	 * Add non–medical ("recreational") products until minimum is met.
	 * Skips any product with a “Medical Only” badge.
	 */
	async conciergeRecAddProductsToCartUntilMinimumMet(page: Page) {
		// Predicate: only add if there is NO .med-metabadge element
		async function recFilter(productEl: Locator) {
			const hasBadge = (await productEl.locator('.wpse-metabadge.med-metabadge').count()) > 0
			if (hasBadge) {
				const title = await productEl.locator('.woocommerce-loop-product__title').innerText()
				console.log(`Skipping "${title.trim()}" (medical only).`)
				return false
			}
			return true
		}

		// Once the minimum is met, go straight to View Cart → Continue to Checkout
		async function recOnMinimum(this: any) {
			console.log('Recreational: minimum reached → going to checkout.')
			await this.viewCartButtonSimple.waitFor({ state: 'visible' })
			await expect(this.viewCartButtonSimple).toBeVisible()
			await this.viewCartButtonSimple.click()

			await this.continueToCheckoutButton.waitFor({ state: 'visible' })
			await expect(this.continueToCheckoutButton).toBeVisible()
			await this.continueToCheckoutButton.click()
		}

		await this.addUntilMinimumMet(page, {
			shouldAddProduct: recFilter.bind(this),
			onMinimumReached: recOnMinimum.bind(this),
			startIndex: 4,
		})
	}

	/**
	 * Add medical-only products until minimum is met.
	 * Skips any product without a "Medical Only" badge. Throws if none found.
	 *
	 * @param {import('@playwright/test').Page} page
	 * @param {string} envType — 'dev', 'stage', or 'prod'
	 */
	async conciergeMedAddProductsToCartUntilMinimumMet(page: Page, envType = 'dev/stage') {
		let sawAnyMed = false,
			medIndex = 0,
			medicalCardProvided = false

		debugLog('=== CONCIERGE MED ADD TO CART ===')
		debugLog(`Current URL: ${page.url()}`)

		// Wait for the products section to load
		await page
			.waitForSelector('.products, ul.products', { state: 'visible', timeout: 10000 })
			.catch(() => {
				debugLog('WARNING: No .products or ul.products found on page!')
			})
		await page.waitForTimeout(2000) // Extra wait for dynamic content

		// PHASE 1: add exactly one med-only product
		let products = page.locator('li.product.type-product.product-type-simple.status-publish')
		let total = await products.count()

		// If specific selector found nothing, try broader selectors
		if (total === 0) {
			debugLog('Specific selector found 0 products, trying broader selector...')
			products = page.locator('ul.products li.product')
			total = await products.count()
		}

		if (total === 0) {
			debugLog('Still 0 products, trying even broader selector...')
			products = page.locator('li.product')
			total = await products.count()
		}

		debugLog(`Found ${total} products on page`)

		for (let i = 0; i < total; i++) {
			const product = products.nth(i)

			// Scroll product into view to ensure visibility
			await product.scrollIntoViewIfNeeded()
			await page.waitForTimeout(200)

			// Try multiple ways to detect if this is a medical product
			const hasMedBadge1 = (await product.locator('.wpse-metabadge.med-metabadge').count()) > 0
			const hasMedBadge2 = (await product.locator('.med-metabadge').count()) > 0
			const hasMedText = (await product.getByText('Medical Only').count()) > 0

			const isMed = hasMedBadge1 || hasMedBadge2 || hasMedText

			if (!isMed) {
				const title = await product
					.locator('.woocommerce-loop-product__title')
					.innerText()
					.catch(() => 'UNKNOWN')
				debugLog(`[${i}] Skipping "${title.trim()}" (not medical-only).`)
				continue
			}
			sawAnyMed = true
			medIndex = i
			debugLog(`[${i}] FOUND MEDICAL PRODUCT - attempting to add to cart...`)
			debugLog(
				`  Detection method: badge1=${hasMedBadge1}, badge2=${hasMedBadge2}, text=${hasMedText}`,
			)

			const name = (await product.locator('.woocommerce-loop-product__title').innerText()).trim()

			// Try multiple button selectors
			let btn = product.locator('button.button.product_type_simple.fasd_to_cart.ajax_groove')
			let btnCount = await btn.count()

			if (btnCount === 0) {
				debugLog('  Primary button selector failed, trying alternatives...')
				btn = product.locator('button.fasd_to_cart')
				btnCount = await btn.count()
			}

			if (btnCount === 0) {
				debugLog('  Secondary button selector failed, trying aria-label...')
				btn = product.locator('button[aria-label*="Add"]')
				btnCount = await btn.count()
			}

			if (btnCount === 0) {
				debugLog('  Trying generic add_to_cart_button...')
				btn = product.locator('button.add_to_cart_button')
				btnCount = await btn.count()
			}

			if (btnCount === 0) {
				debugLog('  Trying any button with + text...')
				btn = product.locator('button:has-text("+")')
				btnCount = await btn.count()
			}

			// DEBUG: Check button state
			const btnVisible = btnCount > 0 ? await btn.isVisible() : false
			debugLog(`  Add to Cart button count: ${btnCount}, visible: ${btnVisible}`)

			if (btnCount === 0) {
				debugLog(`  WARNING: No add button found for product "${name}", skipping...`)
				continue
			}

			await expect(btn).toBeVisible()
			await btn.click()
			debugLog(`  Clicked "Add to Cart" for "${name}"`)

			// Handle "Start a new cart" conflict modal (matches addUntilMinimumMet behavior)
			try {
				const conflictModal = page.locator('.wpse-drawer[data-module="cart-conflict"]')
				await conflictModal.waitFor({ state: 'visible', timeout: 5000 })

				if (await conflictModal.isVisible()) {
					debugLog('Cart conflict modal detected in med Phase 1. Starting a new cart.')
					const startNewCartBtn = conflictModal.locator('button:has-text("Start a new cart")')

					await expect(startNewCartBtn).toBeVisible()
					await startNewCartBtn.click()
					debugLog('Clicked "Start a new cart".')

					await conflictModal.waitFor({ state: 'hidden', timeout: 10000 })
				}
			} catch (e) {
				// Modal didn't appear — that's fine, continue normally
			}

			// wait for drawer & verify
			await page.waitForTimeout(3000)
			await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })
			const inCart = await page.locator(`td.product-name:has(a:has-text("${name}"))`).count()
			if (!inCart) throw new Error(`Couldn't find "${name}" in cart after adding.`)
			debugLog(`  ✓ Added medical item "${name}" to cart successfully.`)

			// close drawer so Phase 2 can run
			await this.closeCartDrawerButton.click()
			await page.waitForTimeout(2000)
			break
		}

		if (!sawAnyMed) {
			console.warn('⚠️ No medical-only products available - skipping medical user test')
			test.skip(true, 'No medical products available at this location')
			return
		}

		// PHASE 2: fill with non-medicals until minimum, then handle med-banner + checkout
		await this.addUntilMinimumMet(page, {
			startIndex: medIndex + 1,
			shouldAddProduct: async (prod: Locator) => {
				const hasBadge = (await prod.locator('.wpse-metabadge.med-metabadge').count()) > 0
				if (hasBadge) {
					const t = await prod.locator('.woocommerce-loop-product__title').innerText()
					debugLog(`Skipping "${t.trim()}" (medical-only).`)
					return false
				}
				return true
			},
			onMinimumReached: async () => {
				debugLog('Minimum reached → checking for medical-only banner…')
				// 1) View Cart
				//click View Cart to go to Cart
				await this.viewCartButtonSimple.waitFor({ state: 'visible' })
				await expect(this.viewCartButtonSimple).toBeVisible()
				await this.viewCartButtonSimple.click()

				// Verify that Cart page loads
				await this.liveCartTitle.waitFor({ state: 'visible' })
				await expect(this.liveCartTitle).toBeVisible()

				// Check for medical-only banner and provide med card info if needed
				const medicalOnlyBanner = page.locator('.wpse-snacktoast.warn-toast').first()
				const medicalOnlyBannerVisible = await medicalOnlyBanner.isVisible()

				if (medicalOnlyBannerVisible && !medicalCardProvided) {
					const bannerText = await medicalOnlyBanner.textContent()
					const isMedBanner = bannerText?.trim().includes('Medical-only product in cart')

					if (isMedBanner) {
						debugLog('Medical-only banner detected. Adding medical card information...')

						// Click the "I have a medical card" checkbox
						const medicalCardCheckbox = page.locator('input#med_included')
						await medicalCardCheckbox.waitFor({ state: 'visible' })
						await expect(medicalCardCheckbox).toBeVisible()
						await medicalCardCheckbox.check()

						// Add the medical card information
						const medCardFileInput = page.locator('input#fasd_medcard')
						const [driversLicenseChooser] = await Promise.all([
							this.page.waitForEvent('filechooser'),
							medCardFileInput.click(),
						])
						const issuingStateSelect = page.locator('select#medcard_state')
						const expirationInput = page.locator('input#medcard_exp')
						await driversLicenseChooser.setFiles('CA-DL.jpg')
						await issuingStateSelect.selectOption('CA')
						const newYear = new Date().getFullYear() + 1
						await expirationInput.click()
						await expirationInput.type(`01/01/${newYear}`)
						// random integer for med card number
						const medCardNumber = page.locator('input#medcard_no')
						const length = Math.floor(Math.random() * 9) + 1
						const randomInteger = Math.floor(Math.random() * 10 ** length)
						await medCardNumber.click()
						await medCardNumber.type(`${randomInteger}`)
						// med birthday
						const firstDate = '01/01/1990'
						const medBirthday = page.locator('#fasd_dob')
						await medBirthday.click()
						await medBirthday.type(firstDate)

						// Submit the medical card information
						const saveMedicalInfoButton = page.locator(
							'.fasd-form-submit:has-text("Save & Continue")',
						)
						await saveMedicalInfoButton.click()

						medicalCardProvided = true

						// reopen the cart since it closes automatically after adding Medical Info
						await this.cartButtonNav.waitFor({ state: 'visible' })
						await expect(this.cartButtonNav).toBeVisible()
						await this.cartButtonNav.click()
						await this.cartDrawerContainer.waitFor({ state: 'visible' })

						// Wait for animations or loading to finish
						await page.waitForTimeout(3000)
					} else {
						debugLog(`Medical banner visible but text did not match: "${bannerText?.trim()}"`)
					}
				}

				// Proceed to checkout
				await this.continueToCheckoutButton.waitFor({ state: 'visible' })
				await expect(this.continueToCheckoutButton).toBeVisible()
				await this.continueToCheckoutButton.click()
			},
		})
	}

	// async conciergeRecAddProductsToCartUntilMinimumMet(page) {
	// 	// Get all the products on the page
	// 	const products = await page.locator(
	// 		'li.product.type-product.product-type-simple.status-publish',
	// 	)

	// 	let i = 4
	// 	while (true) {
	// 		// Check if there are enough products to add
	// 		if (i >= (await products.count())) {
	// 			console.log(`Only ${await products.count()} products available on the page.`)
	// 			break
	// 		}

	// 		// Get the current product
	// 		const product = products.nth(i)

	// 		// Check if the product has the "Medical Only" badge
	// 		const hasMedicalOnlyTag = (await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

	// 		if (hasMedicalOnlyTag) {
	// 			console.log(
	// 				`Skipping product "${await product
	// 					.locator('.woocommerce-loop-product__title')
	// 					.innerText()}" due to "Medical Only" tag.`,
	// 			)
	// 			i++
	// 			continue // Skip this product and move to the next one
	// 		}

	// 		// Get the 'Add to Cart' button and product name for the current product
	// 		//const addToCartButton = product.locator('button.add_to_cart_button')
	// 		const addToCartButton = product.locator(
	// 			'button.button.product_type_simple.fasd_to_cart.ajax_groove',
	// 		)
	// 		const productName = await product.locator('.woocommerce-loop-product__title').innerText()

	// 		// Click the 'Add to Cart' button
	// 		console.log('locator for addtoCartButton: ' + addToCartButton)
	// 		//await page.waitForSelector(addToCartButton)
	// 		await expect(addToCartButton).toBeVisible()
	// 		//await addToCartButton.scrollIntoViewIfNeeded()
	// 		await addToCartButton.click()
	// 		//product page add to cart
	// 		//await this.productPageAddToCartButton.waitFor({ state: 'visible' })
	// 		//await this.productPageAddToCartButton.click()

	// 		await page.waitForTimeout(4000)

	// 		// Wait for the cartDrawer to become visible
	// 		await this.cartDrawerContainer.waitFor({ state: 'visible' })

	// 		const cartItem = await page.locator(
	// 			`td.product-name:has(a:has-text("${productName.trim()}"))`,
	// 		)

	// 		const cartItems = await page.locator(`td.product-name a`).allTextContents()
	// 		console.log('Cart items in the drawer:', cartItems)

	// 		const isProductInCart = (await cartItem.count()) > 0

	// 		if (!isProductInCart) {
	// 			throw new Error(`Product "${productName}" was not found in the cart after being added.`)
	// 		}

	// 		console.log(`Product "${productName}" was successfully added to the cart.`)

	// 		// Check if the "Delivery minimum not met" banner is still visible
	// 		const isBannerVisible = await this.minimumNotMetLabel.isVisible()

	// 		if (!isBannerVisible) {
	// 			console.log('Minimum cart total met. Proceeding to checkout.')
	// 			// Break out of loop to continue in the cart
	// 			break
	// 		}

	// 		// Close the cartDrawer
	// 		await this.closeCartDrawerButton.click()
	// 		// Wait for the cartDrawer to be hidden again
	// 		//await this.cartDrawerContainer.waitFor({ state: 'hidden' })
	// 		await page.waitForTimeout(2000)

	// 		i++ // Increment to the next product
	// 	}

	// 	//click View Cart to go to Cart
	// 	await this.viewCartButtonSimple.waitFor({ state: 'visible' })
	// 	await expect(this.viewCartButtonSimple).toBeVisible()
	// 	await this.viewCartButtonSimple.click()

	// 	// Once the banner is no longer visible, proceed to click the "Continue to checkout" button
	// 	await this.continueToCheckoutButton.waitFor({ state: 'visible' })
	// 	await expect(this.continueToCheckoutButton).toBeVisible()
	// 	await this.continueToCheckoutButton.click()
	// }

	// async conciergeMedAddProductsToCartUntilMinimumMet(page, envType) {
	// 	const products = await page.locator('ul.products li.product')
	// 	let i = 0
	// 	let medicalProductExists = false
	// 	let medicalCardProvided = false

	// 	let productCount = await products.count()

	// 	while (i <= productCount) {
	// 		if (i >= productCount) {
	// 			console.log(`Only ${productCount} products available on the page.`)
	// 			if (!medicalProductExists) {
	// 				throw new Error('No Medical Products found on this page/store/location')
	// 			}
	// 			break
	// 		}

	// 		const product = products.nth(i)
	// 		const hasMedicalOnlyTag = (await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

	// 		if (hasMedicalOnlyTag) {
	// 			medicalProductExists = true
	// 		}

	// 		if (!hasMedicalOnlyTag) {
	// 			console.log(
	// 				`Skipping product "${await product
	// 					.locator('.woocommerce-loop-product__title')
	// 					.innerText()}" as it is not "Medical Only".`,
	// 			)
	// 			i++
	// 			continue
	// 		}

	// 		const addToCartButton = product.locator(
	// 			'button.button.product_type_simple.fasd_to_cart.ajax_groove',
	// 		)
	// 		const productName = await product.locator('.woocommerce-loop-product__title').innerText()
	// 		const productNameNormalized = productName.trim()

	// 		// Add the product to the cart
	// 		await addToCartButton.click()
	// 		await page.waitForTimeout(3000)
	// 		await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })

	// 		const cartItem = page.locator(`td.product-name:has(a:has-text("${productNameNormalized}"))`)
	// 		const isProductInCart = (await cartItem.count()) > 0

	// 		if (!isProductInCart) {
	// 			throw new Error(
	// 				`Product "${productNameNormalized}" was not found in the cart after being added.`,
	// 			)
	// 		}

	// 		console.log(`Product "${productNameNormalized}" was successfully added to the cart.`)

	// 		// Check if the minimum banner is still visible
	// 		const isMinimumBannerVisible = await this.minimumNotMetLabel.isVisible()
	// 		if (!isMinimumBannerVisible) {
	// 			console.log('Minimum cart total met. Proceeding to check for medical card requirements.')
	// 			// View the cart
	// 			await this.viewCartButtonSimple.waitFor({ state: 'visible' })
	// 			await this.viewCartButtonSimple.click()
	// 			//
	// 			await page.waitForTimeout(3000)
	// 			// check if envType is dev/stage or Prod. For Prod, skip adding Med info since using existing user
	// 			// with med card already populated
	// 			if (envType === 'dev/stage') {
	// 				const medicalOnlyBannerVisible = await page
	// 					.locator('.wpse-snacktoast.warn-toast')
	// 					.first()
	// 					.isVisible()
	// 				const medicalOnlyBannerText = await page
	// 					.locator('.wpse-snacktoast.warn-toast')
	// 					.first()
	// 					.textContent()

	// 				const isMedicalOnlyBannerCorrect =
	// 					medicalOnlyBannerVisible &&
	// 					medicalOnlyBannerText?.trim().includes('Medical-only product in cart')

	// 				if (!isMedicalOnlyBannerCorrect) {
	// 					throw new Error('Medical-Only Banner not showing in cart for medical only products')
	// 				}
	// 				// // verify medical cart banner shows when medical product is in cart
	// 				// try {
	// 				// 	await expect(this.medicalOnlyBanner).toBeVisible()
	// 				// } catch (error) {
	// 				// 	throw new Error(
	// 				// 		'Med Card Verification not working -- Cart Banner for Med Products not showing',
	// 				// 	)
	// 				// }
	// 				if (isMedicalOnlyBannerCorrect && !medicalCardProvided) {
	// 					console.log('Medical-only product in cart. Adding medical card information...')

	// 					// Add the medical card information
	// 					const medicalCardCheckbox = page.locator('input#med_included')
	// 					await medicalCardCheckbox.check()

	// 					const medCardFileInput = page.locator('input#fasd_medcard')
	// 					const [fileChooser] = await Promise.all([
	// 						page.waitForEvent('filechooser'),
	// 						medCardFileInput.click(),
	// 					])
	// 					await fileChooser.setFiles('Medical-Card.png')

	// 					// const issuingStateSelect = page.locator('select#medcard_state')
	// 					// const expirationInput = page.locator('input#medcard_exp')
	// 					await this.issuingStateSelect.selectOption('CA')
	// 					const newYear = new Date().getFullYear() + 1
	// 					await this.expirationInput.click()
	// 					await this.expirationInput.type(`01/01/${newYear}`)
	// 					// random integer for med card number
	// 					const medCardNumber = page.locator('input#medcard_no')
	// 					const length = Math.floor(Math.random() * 9) + 1
	// 					const randomInteger = Math.floor(Math.random() * 10 ** length)
	// 					await medCardNumber.click()
	// 					await medCardNumber.type(`${randomInteger}`)

	// 					const saveMedicalInfoButton = page.locator(
	// 						'.fasd-form-submit:has-text("Save & Continue")',
	// 					)
	// 					await saveMedicalInfoButton.click()
	// 					medicalCardProvided = true

	// 					await page.waitForTimeout(3000)

	// 					// View the cart
	// 					await this.cartButtonNav.waitFor({ state: 'visible' })
	// 					await this.cartButtonNav.click()
	// 					await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })
	// 				}
	// 			}
	// 			// Proceed to checkout
	// 			console.log('All requirements met. Proceeding to Checkout.')
	// 			await this.continueToCheckoutButton.waitFor({ state: 'visible' })
	// 			await this.continueToCheckoutButton.click()
	// 			//
	// 			// break loop if order minimum is met
	// 			break
	// 		}

	// 		// Close the cart drawer and wait before adding another product
	// 		await this.closeCartDrawerButton.click()
	// 		await page.waitForTimeout(2000)

	// 		//i++ // Increment to the next product
	// 	}
	// }

	async liveRecAddProductsToCartUntilMinimumMet(page: Page) {
		// Get all the products on the page
		const products = await page.locator(
			'li.product.type-product.product-type-simple.status-publish',
		)

		let i = 3
		let firstProductAdded = false // Track if the first product has been added

		while (true) {
			// Check if there are enough products to add
			if (i >= (await products.count())) {
				console.log(`Only ${await products.count()} products available on the page.`)
				break
			}

			// Get the current product
			const product = products.nth(i)

			// Check if the product has the "Medical Only" badge
			const hasMedicalOnlyTag = (await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

			if (hasMedicalOnlyTag) {
				console.log(
					`Skipping product "${await product
						.locator('.woocommerce-loop-product__title')
						.innerText()}" due to "Medical Only" tag.`,
				)
				i++
				continue // Skip this product and move to the next one
			}

			const productName = await product.locator('.woocommerce-loop-product__title').innerText()

			// Flow for the first product (click into the product page)
			if (!firstProductAdded) {
				const productClickInto = product.locator('img.woocommerce-placeholder.wp-post-image')

				console.log('locator for productClickInto: ' + productClickInto)
				await expect(productClickInto).toBeVisible()
				await productClickInto.click()

				// Wait for and click 'Add to Cart' on the product page
				// Wait for and click 'Add to Cart' on the product page
				// await this.productPageAddToCartButton.nth(0).waitFor({ state: 'visible' })
				// await this.productPageAddToCartButton.nth(0).hover()
				// await page.waitForTimeout(200)
				// await this.productPageAddToCartButton.nth(0).click()
				const addToCart = page.getByRole('button', { name: /^add to cart$/i }).first()
				await addToCart.waitFor({ state: 'visible' })
				// wait for it to appear...
				await expect(addToCart).toBeVisible()
				// …and click it
				await addToCart.click()

				// Check for "Start a new cart" modal
				try {
					const conflictModal = page.locator('.wpse-drawer[data-module="cart-conflict"]')
					await conflictModal.waitFor({ state: 'visible', timeout: 5000 })
					
					if (await conflictModal.isVisible()) {
						console.log('Cart conflict modal detected in liveRecAddProductsToCartUntilMinimumMet (First Product). start new cart.')
						const startNewCartBtn = conflictModal.locator('button:has-text("Start a new cart")') 
						await expect(startNewCartBtn).toBeVisible()
						await startNewCartBtn.click()
						await conflictModal.waitFor({ state: 'hidden', timeout: 10000 })
					}
				} catch (e) {}

				await page.waitForTimeout(8000)
				await page.waitForLoadState('networkidle')

				// Wait for the cart drawer to become visible
				await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })

				// Check if the product was added to the cart
				const cartItem = await page.locator(`td.product-name a:has-text("${productName}")`)
				const isProductInCart = (await cartItem.count()) > 0

				if (!isProductInCart) {
					throw new Error(`Product "${productName}" was not found in the cart after being added.`)
				}

				console.log(`First product "${productName}" was successfully added to the cart.`)

				firstProductAdded = true

				// Check if the "Delivery minimum not met" banner is still visible
				const isBannerVisible = await this.minimumNotMetLabel.isVisible()
				if (!isBannerVisible) {
					console.log('Minimum cart total met. Proceeding to checkout.')
					break // Stop adding products if the minimum is met
				}
				//click View Cart to go to Cart
				await this.viewCartButtonSimple.waitFor({ state: 'visible' })
				await expect(this.viewCartButtonSimple).toBeVisible()
				await this.viewCartButtonSimple.click()

				// Click "Add more Items to continue"
				await this.cartContinueShoppingButton.waitFor({ state: 'visible' })
				await this.cartContinueShoppingButton.click()
				await page.waitForTimeout(2000)
			} else {
				// Flow for adding products directly from the homepage

				const addToCartButton = product.locator(
					'button.product_type_simple.fasd_to_cart.ajax_groove',
				)
				console.log('locator for addToCartButton: ' + addToCartButton)
				await expect(addToCartButton).toBeVisible()
				await addToCartButton.click()

				// Check for "Start a new cart" modal
				try {
					const conflictModal = page.locator('.wpse-drawer[data-module="cart-conflict"]')
					await conflictModal.waitFor({ state: 'visible', timeout: 5000 })
					
					if (await conflictModal.isVisible()) {
						console.log('Cart conflict modal detected in liveRecAddProductsToCartUntilMinimumMet (Subsequent Product). start new cart.')
						const startNewCartBtn = conflictModal.locator('button:has-text("Start a new cart")') 
						await expect(startNewCartBtn).toBeVisible()
						await startNewCartBtn.click()
						await conflictModal.waitFor({ state: 'hidden', timeout: 10000 })
					}
				} catch (e) {}

				await page.waitForTimeout(4000)

				// Wait for the cart drawer to become visible
				await this.cartDrawerContainer.waitFor({ state: 'visible' })

				// Check if the product was added to the cart
				const cartItem = await page.locator(`td.product-name a:has-text("${productName}")`)
				const isProductInCart = (await cartItem.count()) > 0

				if (!isProductInCart) {
					throw new Error(`Product "${productName}" was not found in the cart after being added.`)
				}

				console.log(`Product "${productName}" was successfully added to the cart.`)

				// Check if the "Delivery minimum not met" banner is still visible
				const isBannerVisible = await this.minimumNotMetLabel.isVisible()
				if (!isBannerVisible) {
					console.log('Minimum cart total met. Proceeding to checkout.')
					break
				}
				//click View Cart to go to Cart
				await this.viewCartButtonSimple.waitFor({ state: 'visible' })
				await expect(this.viewCartButtonSimple).toBeVisible()
				await this.viewCartButtonSimple.click()
				// Click "Add more Items to continue"
				await this.cartContinueShoppingButton.waitFor({ state: 'visible' })
				await this.cartContinueShoppingButton.click()
				await page.waitForTimeout(2000)
			}

			i++ // Increment to the next product
		}

		// Once the banner is no longer visible, proceed to Cart
		// await this.liveViewCartCheckout.waitFor({ state: 'visible' })
		// await expect(this.liveViewCartCheckout).toBeVisible()
		// await this.liveViewCartCheckout.click()
		//click View Cart to go to Cart
		await this.viewCartButtonSimple.waitFor({ state: 'visible' })
		await expect(this.viewCartButtonSimple).toBeVisible()
		await this.viewCartButtonSimple.click()
		// verify that Cart page loads
		await this.liveCartTitle.waitFor({ state: 'visible' })
		await expect(this.liveCartTitle).toBeVisible()
		// once on Cart page, proceed to Checkout
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}

	// function to only add MED-only products to a cart in order to test MED users
	// function searches for med-only products with the med tag, adds that product to cart,
	// checks if Med card needs to be added, adds the med card, and then verifies if cart minimum is reached
	// adding the same med-only product to cart until the min is reached
	async liveMedAddProductsToCartUntilMinimumMet(page: Page, envType: string) {
		// Get all the products on the page
		const products = await page.locator(
			'li.product.type-product.product-type-simple.status-publish',
		)

		let i = 1
		let medicalProductExists = false
		let firstMedicalProductAdded = false // Track if the first product added is a medical product
		let medicalCardProvided = false

		let productCount = await products.count()

		while (i <= productCount) {
			// Check if there are enough products to add
			if (i >= productCount) {
				console.log(`Only ${productCount} products available on the page.`)
				if (!medicalProductExists) {
					throw new Error('No Medical Products found on this page/store/location')
				}
				break
			}

			// Get the current product
			const product = products.nth(i)

			// Check if the product has the "Medical Only" badge
			const hasMedicalOnlyTag = (await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

			if (hasMedicalOnlyTag) {
				medicalProductExists = true
			}

			if (!firstMedicalProductAdded && hasMedicalOnlyTag) {
				// Add the first Medical-Only product to the cart
				const productName = await product.locator('.woocommerce-loop-product__title').innerText()
				const productClickInto = product.locator('img.woocommerce-placeholder.wp-post-image')

				console.log('Adding first medical-only product: ' + productName)
				await expect(productClickInto).toBeVisible()
				await productClickInto.click()

				// Wait for and click 'Add to Cart' on the product page
				// await this.productPageAddToCartButton.nth(0).waitFor({ state: 'visible' })
				// await this.productPageAddToCartButton.nth(0).hover()
				// await page.waitForTimeout(200)
				// await this.productPageAddToCartButton.nth(0).click()
				const addToCart = page.getByRole('button', { name: /^add to cart$/i }).first()
				await addToCart.waitFor({ state: 'visible' })
				// wait for it to appear...
				await expect(addToCart).toBeVisible()
				// …and click it
				await addToCart.click()
				await page.waitForTimeout(8000)
				await page.waitForLoadState('networkidle') // Wait for all network requests to finish

				// Wait for the cart drawer to become visible
				await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })

				// Verify the product is added
				const cartItem = await page.locator(`td.product-name a:has-text("${productName}")`)
				const isProductInCart = (await cartItem.count()) > 0

				if (!isProductInCart) {
					throw new Error(
						`Medical-only product "${productName}" was not found in the cart after being added.`,
					)
				}

				console.log(
					`First medical-only product "${productName}" was successfully added to the cart.`,
				)
				firstMedicalProductAdded = true

				// Check if the "Delivery minimum not met" banner is still visible
				const isBannerVisible = await this.minimumNotMetLabel.isVisible()
				if (!isBannerVisible) {
					console.log('Minimum cart total met. Proceeding to checkout.')
					break // Stop adding products if the minimum is met
				}
				//click View Cart to go to Cart
				await this.viewCartButtonSimple.waitFor({ state: 'visible' })
				await expect(this.viewCartButtonSimple).toBeVisible()
				await this.viewCartButtonSimple.click()
				// Click "Add more Items to continue"
				await this.cartContinueShoppingButton.waitFor({ state: 'visible' })
				await this.cartContinueShoppingButton.click()
				await page.waitForTimeout(2000)
			} else if (firstMedicalProductAdded) {
				// Flow for adding subsequent products directly from the homepage
				const productName = await product.locator('.woocommerce-loop-product__title').innerText()
				const addToCartButton = product.locator(
					'button.product_type_simple.fasd_to_cart.ajax_groove',
				)

				console.log('Adding product from homepage: ' + productName)
				await expect(addToCartButton).toBeVisible()

				// Scroll the button to the center of the viewport to avoid it being obscured by category tabs
				await addToCartButton.evaluate((element: HTMLElement) => {
					element.scrollIntoView({ block: 'center', behavior: 'smooth' })
				})
				await page.waitForTimeout(500) // Wait for smooth scroll to complete

				await addToCartButton.click()
				await page.waitForTimeout(10000)

				// Wait for the cart drawer to become visible
				await this.cartDrawerContainer.waitFor({ state: 'visible' })

				// Verify the product is added
				const cartItem = await page.locator(`td.product-name a:has-text("${productName}")`)
				const isProductInCart = (await cartItem.count()) > 0

				if (!isProductInCart) {
					throw new Error(`Product "${productName}" was not found in the cart after being added.`)
				}

				console.log(`Product "${productName}" was successfully added to the cart.`)

				// Check if the "Delivery minimum not met" banner is still visible
				const isBannerVisible = await this.minimumNotMetLabel.isVisible()
				if (!isBannerVisible) {
					console.log('Minimum cart total met. Proceeding to checkout.')
					break
				}
				//click View Cart to go to Cart
				await this.viewCartButtonSimple.waitFor({ state: 'visible' })
				await expect(this.viewCartButtonSimple).toBeVisible()
				await this.viewCartButtonSimple.click()
				// Click "Add more Items to continue"
				await this.cartContinueShoppingButton.waitFor({ state: 'visible' })
				await this.cartContinueShoppingButton.click()
				await page.waitForTimeout(2000)
			}

			i++ // Increment to the next product
		}

		// Once the banner is no longer visible, proceed to Cart
		// await this.liveViewCartCheckout.waitFor({ state: 'visible' })
		// await expect(this.liveViewCartCheckout).toBeVisible()
		// await this.liveViewCartCheckout.click()
		//click View Cart to go to Cart
		await this.viewCartButtonSimple.waitFor({ state: 'visible' })
		await expect(this.viewCartButtonSimple).toBeVisible()
		await this.viewCartButtonSimple.click()

		// Verify that Cart page loads
		await this.liveCartTitle.waitFor({ state: 'visible' })
		await expect(this.liveCartTitle).toBeVisible()

		if (envType === 'dev/stage') {
			const medicalOnlyBannerVisible = await page
				.locator('.wpse-snacktoast.warn-toast')
				.first()
				.isVisible()
			const medicalOnlyBannerText = await page
				.locator('.wpse-snacktoast.warn-toast')
				.first()
				.textContent()

			const isMedicalOnlyBannerCorrect =
				medicalOnlyBannerVisible &&
				medicalOnlyBannerText?.trim().includes('Medical-only product in cart')

			if (!isMedicalOnlyBannerCorrect) {
				throw new Error('Medical-Only Banner not showing in cart for medical only products')
			}

			if (isMedicalOnlyBannerCorrect && !medicalCardProvided) {
				console.log('Medical-only product in cart. Adding medical card information...')

				// Click the "I have a medical card" checkbox
				const medicalCardCheckbox = page.locator('input#med_included')
				await medicalCardCheckbox.waitFor({ state: 'visible' })
				await expect(medicalCardCheckbox).toBeVisible()
				await medicalCardCheckbox.check()

				// Add the medical card information
				const medCardFileInput = page.locator('input#fasd_medcard')
				const [driversLicenseChooser] = await Promise.all([
					this.page.waitForEvent('filechooser'),
					medCardFileInput.click(),
				])
				const issuingStateSelect = page.locator('select#medcard_state')
				const expirationInput = page.locator('input#medcard_exp')
				await driversLicenseChooser.setFiles('CA-DL.jpg')
				await issuingStateSelect.selectOption('CA')
				const newYear = new Date().getFullYear() + 1
				await expirationInput.click()
				await expirationInput.type(`01/01/${newYear}`)
				// random integer for med card number
				const medCardNumber = page.locator('input#medcard_no')
				const length = Math.floor(Math.random() * 9) + 1
				const randomInteger = Math.floor(Math.random() * 10 ** length)
				await medCardNumber.click()
				await medCardNumber.type(`${randomInteger}`)
				const firstDate = '01/01/1990'
				const medBirthday = page.locator('#fasd_dob')
				await medBirthday.click()
				await medBirthday.type(firstDate)

				// Submit the medical card information
				const saveMedicalInfoButton = page.locator('.fasd-form-submit:has-text("Save & Continue")')
				await saveMedicalInfoButton.click()

				medicalCardProvided = true

				// reopen the cart since it closes automatically after adding Medical Info
				await this.cartButtonNav.waitFor({ state: 'visible' })
				await expect(this.cartButtonNav).toBeVisible()
				await this.cartButtonNav.click()
				// Wait for the cart drawer to become visible
				await this.cartDrawerContainer.waitFor({ state: 'visible' })
				// continue to Checkout
				// await this.medCartCheckoutButton.waitFor({ state: 'visible' })
				// await expect(this.medCartCheckoutButton).toBeVisible()
				// await this.medCartCheckoutButton.click()

				// Wait for animations or loading to finish
				await page.waitForTimeout(3000)
			}
		}

		// Proceed to checkout after medical info is provided
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}

	//
	// FUTURE consolidated Med add to cart function
	async medAddProductsToCartUntilMinimumMet(
		page: Page,
		{ mode = 'concierge', productSelector, startIndex = 0, isMultiStore = false }: { mode: string; productSelector: string; startIndex: number; isMultiStore: boolean },
	) {
		let i = startIndex
		let medicalProductExists = false
		let firstMedicalProductAdded = false
		let medicalCardProvided = false

		// Get all products using the passed-in selector
		const products = await page.locator(productSelector)
		const productCount = await products.count()

		// Main loop
		while (i <= productCount) {
			if (i >= productCount) {
				console.log(`Only ${productCount} products available on the page.`)
				if (!medicalProductExists) {
					throw new Error('No Medical Products found on this page/store/location')
				}
				break
			}

			const product = products.nth(i)
			const hasMedicalTag = await this.isMedicalProduct(product)

			// Mark that we at least found a medical product
			if (hasMedicalTag) {
				medicalProductExists = true
			}

			// Skip product if it’s not medical
			if (!hasMedicalTag) {
				await this.logSkippingNonMedical(product)
				i++
				continue
			}

			// Special flow for multi-store “Live” mode:
			// If we haven’t added any medical product yet, we drill into the product page.
			// Otherwise, we can add directly from the homepage (as your code demonstrates).
			if (isMultiStore && !firstMedicalProductAdded) {
				await this.addFirstMedicalProduct(page, product)
				firstMedicalProductAdded = true
			} else {
				// In Concierge mode, or subsequent adds in Live mode
				await this.addMedicalProductDirect(page, product, mode)
			}

			// Check if min is met
			const stillBelowMinimum = await this.minimumNotMetLabel.isVisible()
			if (!stillBelowMinimum) {
				console.log('Minimum cart total met. Proceeding to medical card requirements...')
				// “View Cart” or navigate to cart for final checks
				await this.goToCart(page)
				await this.checkMedicalBannerAndMaybeUploadCard(page, medicalCardProvided)
				break // Stop adding more products
			}

			// If in multi-store mode and min still not met, user returns to product list
			if (isMultiStore) {
				await this.continueShopping(page)
			}

			i++
		}
	}
	// 1) Check if a product is "Medical Only"
	async isMedicalProduct(product: Locator) {
		const count = await product.locator('.wpse-metabadge.med-metabadge').count()
		return count > 0
	}

	// 2) Log skipping message for non-medical product
	async logSkippingNonMedical(product: Locator) {
		const title = await product.locator('.woocommerce-loop-product__title').innerText()
		console.log(`Skipping product "${title.trim()}" as it is not "Medical Only".`)
	}

	// 3) Add the FIRST medical-only product in Live mode
	//    (where you click into product details, then add to cart)
	async addFirstMedicalProduct(page: Page, product: Locator) {
		const productName = await product.locator('.woocommerce-loop-product__title').innerText()
		const productClickInto = product.locator('img.woocommerce-placeholder.wp-post-image')

		console.log(`Adding first medical-only product: ${productName}`)
		await productClickInto.click()

		// Wait and click "Add to Cart" on the product details page
		await this.productPageAddToCartButton.nth(0).waitFor({ state: 'visible' })
		await this.productPageAddToCartButton.nth(0).click()

		// Wait for the cart drawer
		await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })

		// Verify it’s in the cart
		await this.verifyProductInCart(page, productName)
	}

	// 4) Add a medical product directly from the product card
	//    Used by Concierge or subsequent additions in Live
	async addMedicalProductDirect(page: Page, product: Locator, mode: string) {
		const productName = await product.locator('.woocommerce-loop-product__title').innerText()
		console.log(`Adding product from listing: ${productName}`)

		if (mode === 'concierge') {
			// Concierge: one store, direct "Add to Cart" button on the product card
			const addBtn = product.locator('button.button.product_type_simple.fasd_to_cart.ajax_groove')
			await addBtn.click()
		} else {
			// Live mode (after first product): you might still have a direct "Add to Cart" button
			// Adjust if your selectors differ
			const addBtn = product.locator('button.product_type_simple.fasd_to_cart.ajax_groove')
			await addBtn.click()
		}

		// Wait for cart drawer
		await page.waitForTimeout(4000)
		await this.cartDrawerContainer.waitFor({ state: 'visible' })

		// Verify it’s in the cart
		await this.verifyProductInCart(page, productName)
	}

	// 5) Verify a product is in the cart
	async verifyProductInCart(page: Page, productName: string) {
		// Ensure the cart item is rendered
		await page.waitForSelector('td.product-name')

		// Grab the text from that single cart item
		const cartItemLocator = page.locator('td.product-name')
		const cartItemText = await cartItemLocator.innerText()
		const textTrimmed = cartItemText.trim()

		// (Optional) Log it out to see exactly what text is returned
		console.log('Cart item text:', textTrimmed)

		// Check if it includes the product name
		if (!textTrimmed.includes(productName)) {
			throw new Error(`Product "${productName}" was not found in the cart after being added.`)
		}

		console.log(`Product "${productName}" was successfully found in the cart.`)
	}

	// 6) Go to cart (shared step in both modes)
	async goToCart(page: Page) {
		await this.viewCartButtonSimple.waitFor({ state: 'visible' })
		await this.viewCartButtonSimple.click()
		// Possibly wait for the cart page or cart drawer to appear
		await page.waitForTimeout(2000)
	}

	// 7) Check medical-only banner and optionally upload med card info
	async checkMedicalBannerAndMaybeUploadCard(page: Page, medicalCardProvided: boolean) {
		// Check banner
		const banner = page.locator('.wpse-snacktoast.warn-toast').nth(1)
		const isBannerVisible = await banner.isVisible()
		const bannerText = (await banner.textContent())?.trim() || ''

		if (!isBannerVisible || !bannerText.includes('Medical-only product in cart')) {
			throw new Error('Medical-Only Banner not showing in cart for medical-only products.')
		}

		// If the user hasn’t uploaded a medical card yet, do it now
		if (!medicalCardProvided) {
			console.log('Medical-only product in cart. Adding medical card information...')

			const medicalCardCheckbox = page.locator('input#med_included')
			await medicalCardCheckbox.check()

			const medCardFileInput = page.locator('input#fasd_medcard')
			const [fileChooser] = await Promise.all([
				page.waitForEvent('filechooser'),
				medCardFileInput.click(),
			])
			await fileChooser.setFiles('Medical-Card.png')

			// State selection & expiration
			await this.issuingStateSelect.selectOption('CA')
			const newYear = new Date().getFullYear() + 1
			await this.expirationInput.click()
			await this.expirationInput.type(`01/01/${newYear}`)

			// Click "Save & Continue"
			const saveMedicalInfoButton = page.locator('.fasd-form-submit:has-text("Save & Continue")')
			await saveMedicalInfoButton.click()
			await page.waitForTimeout(3000)

			// Re-open cart if needed
			await this.cartButtonNav.waitFor({ state: 'visible' })
			await this.cartButtonNav.click()
			await this.cartDrawerContainer.waitFor({ state: 'visible' })

			console.log('Medical card information saved. Proceeding to checkout...')
		}

		// Final checkout
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await this.continueToCheckoutButton.click()
	}
	async goToMainStorePage(page: Page) {
		// Typically, you click something like "Add more items to continue"
		await page.waitForTimeout(2000)
		await this.homePageButton710.waitFor({ state: 'visible' })
		await this.homePageButton710.click({ force: true })
		await this.homePageButton710.click({ force: true })
		await page.waitForTimeout(2000)
	}

	// 8) Continue Shopping in Live mode
	async continueShopping(page: Page) {
		// Typically, you click something like "Add more items to continue"
		await this.cartContinueShoppingButton.waitFor({ state: 'visible' })
		await this.cartContinueShoppingButton.click()
		await page.waitForTimeout(2000)
	}
	async newConciergeMedAddProductsToCartUntilMinimumMet(page: Page) {
		return this.medAddProductsToCartUntilMinimumMet(page, {
			mode: 'concierge',
			productSelector: 'ul.products li.product',
			startIndex: 0,
			isMultiStore: false,
		})
	}

	async newLiveMedAddProductsToCartUntilMinimumMet(page: Page) {
		return this.medAddProductsToCartUntilMinimumMet(page, {
			mode: 'live',
			productSelector: 'li.product.type-product.product-type-simple.status-publish',
			startIndex: 4,
			isMultiStore: true,
		})
	}

	async addSingleProductToCart(page: Page) {
		// Get all the products on the page (no await needed - locator returns synchronously)
		const products = page.locator('li.product.type-product.product-type-simple.status-publish')

		// Wait for products to load before counting them
		await products.first().waitFor({ state: 'visible', timeout: 10000 })

		const productCount = await products.count()
		console.log(`Found ${productCount} products on the page`)

		let i = 1 // Start from index 3 like the original function

		// Loop through products to find one without "Medical Only" tag
		while (i < productCount) {
			// Get the current product
			const product = products.nth(i)

			// Check if the product has the "Medical Only" badge
			const hasMedicalOnlyTag = (await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

			if (hasMedicalOnlyTag) {
				const productName = await product.locator('.woocommerce-loop-product__title').innerText()
				console.log(`Skipping product "${productName}" (index ${i}) due to "Medical Only" tag.`)
				i++
				continue // Skip to next product
			}

			// Found a suitable product, proceed to add it
			const productName = await product.locator('.woocommerce-loop-product__title').innerText()
			const productClickInto = product.locator('img.woocommerce-placeholder.wp-post-image')

			console.log(`Adding product "${productName}" (index ${i}) to cart`)

			await expect(productClickInto).toBeVisible()
			await productClickInto.click()
			await page.waitForTimeout(3000)

			// grabs the first visible button whose name is "Add to cart"
			const addToCart = page.getByRole('button', { name: /^add to cart$/i }).first()
			// wait for it to appear...
			await expect(addToCart).toBeVisible()
			// …and click it
			await addToCart.click({ force: true })

			console.log(`Product "${productName}" add to cart button clicked. Checking for potential 'Start a new cart' modal...`)

			// Check for "Start a new cart" modal
			try {
				const conflictModal = page.locator('.wpse-drawer[data-module="cart-conflict"]')
				// Short timeout because if it's going to appear, it should be relatively quick.
				// We don't want to wait too long if it doesn't appear.
				await conflictModal.waitFor({ state: 'visible', timeout: 5000 })
				
				if (await conflictModal.isVisible()) {
					console.log('Cart conflict modal detected. Attempting to start a new cart.')
					const startNewCartBtn = conflictModal.locator('button:has-text("Start a new cart")') 
					// Fallback selector or more specific if needed: #conflictOverride button
					
					await expect(startNewCartBtn).toBeVisible()
					await startNewCartBtn.click()
					console.log('Clicked "Start a new cart".')
					
					// Wait for modal to disappear to ensure action was processed
					await conflictModal.waitFor({ state: 'hidden', timeout: 10000 })
				} else {
					console.log('Cart conflict modal not visible after wait.')
				}
			} catch (e) {
				console.log('Cart conflict modal did not appear (timeout or other). Continuing...')
			}

			console.log(`Product "${productName}" add to cart process finished. Function complete.`)
			return // Successfully added a product, exit function
		}

		// If we've exhausted all products without finding a suitable one
		throw new Error(
			`Could not find a suitable non-medical product to add. Checked ${productCount} products starting from index 3.`,
		)
	}
}
module.exports = { HomePageActions }
