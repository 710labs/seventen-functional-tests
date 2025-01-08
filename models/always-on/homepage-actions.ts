require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

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
		this.enterAddressButtonConciergeDesktop = page
			.locator('.wpse-button-storenav.wpse-openerize')
			.first()
		this.enterAddressButtonConciergeMobile = page
			.locator('.wpse-button-storenav.wpse-openerize')
			.nth(1)
		this.addressInfoSideBarContainer = page.locator('div.wpse-drawer[data-module="fulfillment"]')
		this.addressField = page.locator('#fasd_address')
		this.submitAddressButton = page.locator('button.wpse-button-primary.fasd-form-submit')
		this.cartDrawerContainer = page.locator('#cartDrawer')
		this.closeCartDrawerButton = page
			.locator('button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer')
			.nth(1)
		this.closeCartButtonGeneric = page.locator(
			'button.wpse-button-mobsaf.wpse-button-close.wpse-closerizer',
		)
		this.minimumNotMetLabel = page.locator('div.wpse-snacktoast')
		this.continueToCheckoutButton = page.locator('a.checkout-button.button.alt.wc-forward')
		this.productPageAddToCartButton = page.locator('button.wpse-button-primary.fasd_to_cart')
		this.cartContinueShoppingButton = page.locator('a:has-text("Add more items")')
		this.liveViewCartCheckout = page.locator('a:has-text("View cart and checkout")')
		this.liveChangeAddressButton = page.locator('span.fasd-nested-unrollable')
		this.liveCartTitle = page.locator('h6:has-text("Your cart from")')
		this.medCartCheckoutButton = page.locator('a.checkout-button.button.alt.wc-forward')
		this.viewCartButtonSimple = page.locator('a:has-text("View Cart")')
		this.medicalOnlyBanner = page.locator('.wpse-snacktoast.warn-toast.med-issue')
		this.issuingStateSelect = page.locator('#medcard_state')
		this.expirationInput = page.locator('input#medcard_exp')
	}
	async openAddressSection(page, storeType) {
		const viewportSize = await page.viewportSize()
		if (storeType == 'concierge') {
			if (viewportSize.width <= 768) {
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
		} else if (storeType == 'live') {
			if (viewportSize.width <= 768) {
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
	async submitAddress(page) {
		await this.page.waitForTimeout(1500)
		await expect(this.submitAddressButton).toBeVisible()
		await this.submitAddressButton.click()
		await this.page.waitForTimeout(1500)
	}
	async enterAddress(page, storeType, addressParam) {
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
	async selectAddressFromList(page, storeType, addressToSelect) {
		await test.step('Click address button', async () => {
			await this.openAddressSection(page, storeType)
		})
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
		// View the cart
		await this.cartButtonNav.waitFor({ state: 'visible' })
		await this.cartButtonNav.click()
		await this.page.waitForTimeout(2000)
		await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })
	}
	async closeCart() {
		// Close the cart drawer and wait before adding product
		await this.closeCartButtonGeneric.first().click()
		await this.page.waitForTimeout(2000)
	}
	async clearProductsFromCart(page) {
		// View the cart
		await this.openCart()
		// Define the locator for your element
		const nothingInCartElement = page.locator('#radicalCartLayout.empty-radical-cart')
		// Check visibility of Nothing In Cart
		const isCartEmpty = await nothingInCartElement.isVisible()

		if (isCartEmpty) {
			console.log('Cart is empty. Returning to store page to add products')
			await this.closeCart()
			return
		} else if (!isCartEmpty) {
			console.log('Cart is NOT empty. Deleting the items in the cart in order to start fresh')
			// TODO: Handle the case where the cart layout is not visible
			// Wait until at least one cart-item row is visible
			await page.waitForSelector('tr.woocommerce-cart-form__cart-item')

			// Get all product rows currently in the cart
			const cartRows = page.locator('tr.woocommerce-cart-form__cart-item')
			const rowCount = await cartRows.count()

			for (let i = 0; i < rowCount; i++) {
				// Re-locate cart-item rows in case the DOM changed after a removal
				const currentRows = page.locator('tr.woocommerce-cart-form__cart-item')
				const countNow = await currentRows.count()

				// If no items found, break out (cart is empty)
				if (countNow === 0) {
					console.log('Cart is already empty!')
					break
				}

				// Otherwise, remove the first row
				// 1) Grab the first row
				const firstRow = currentRows.first()

				// 2) Click its remove link (the anchor with class .remove)
				const removeLink = firstRow.locator('td.product-remove .remove')

				// If it's hidden or not "visible," either use { force: true } or a direct DOM click:
				// await removeLink.click({ force: true });
				await removeLink.evaluate(el => el.click())

				// 3) Wait for that row to vanish from the DOM
				await firstRow.waitFor({ state: 'detached' })

				console.log(`Removed product row #${i + 1} via X link`)
				// reopene Cart after product is removed
				await this.openCart()
			}

			const finalCount = await cartRows.count()
			if (finalCount > 0) {
				throw new Error(`Expected empty cart but found ${finalCount} item(s) still present.`)
			} else if (await nothingInCartElement.isVisible()) {
				console.log('Cart is now cleared and empty. Returning to store page to add products')
				// Close the cart drawer and wait before adding product
				await this.closeCart()
				await page.waitForTimeout(3000) // Adjust this timeout based on your app's behavior
			}
		}
	}
	async addProductsToCart(page, numberOfItems) {
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
	async conciergeRecAddProductsToCartUntilMinimumMet(page) {
		// Get all the products on the page
		const products = await page.locator(
			'li.product.type-product.product-type-simple.status-publish',
		)

		let i = 4
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

			// Get the 'Add to Cart' button and product name for the current product
			//const addToCartButton = product.locator('button.add_to_cart_button')
			const addToCartButton = product.locator(
				'button.button.product_type_simple.fasd_to_cart.ajax_groove',
			)
			const productName = await product.locator('.woocommerce-loop-product__title').innerText()

			// Click the 'Add to Cart' button
			console.log('locator for addtoCartButton: ' + addToCartButton)
			//await page.waitForSelector(addToCartButton)
			await expect(addToCartButton).toBeVisible()
			//await addToCartButton.scrollIntoViewIfNeeded()
			await addToCartButton.click()
			//product page add to cart
			//await this.productPageAddToCartButton.waitFor({ state: 'visible' })
			//await this.productPageAddToCartButton.click()

			await page.waitForTimeout(4000)

			// Wait for the cartDrawer to become visible
			await this.cartDrawerContainer.waitFor({ state: 'visible' })

			const cartItem = await page.locator(
				`td.product-name:has(a:has-text("${productName.trim()}"))`,
			)

			const cartItems = await page.locator(`td.product-name a`).allTextContents()
			console.log('Cart items in the drawer:', cartItems)

			const isProductInCart = (await cartItem.count()) > 0

			if (!isProductInCart) {
				throw new Error(`Product "${productName}" was not found in the cart after being added.`)
			}

			console.log(`Product "${productName}" was successfully added to the cart.`)

			// Check if the "Delivery minimum not met" banner is still visible
			const isBannerVisible = await this.minimumNotMetLabel.isVisible()

			if (!isBannerVisible) {
				console.log('Minimum cart total met. Proceeding to checkout.')
				// Break out of loop to continue in the cart
				break
			}

			// Close the cartDrawer
			await this.closeCartDrawerButton.click()
			// Wait for the cartDrawer to be hidden again
			//await this.cartDrawerContainer.waitFor({ state: 'hidden' })
			await page.waitForTimeout(2000)

			i++ // Increment to the next product
		}

		//click View Cart to go to Cart
		await this.viewCartButtonSimple.waitFor({ state: 'visible' })
		await expect(this.viewCartButtonSimple).toBeVisible()
		await this.viewCartButtonSimple.click()

		// Once the banner is no longer visible, proceed to click the "Continue to checkout" button
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}

	async conciergeMedAddProductsToCartUntilMinimumMet(page) {
		const products = await page.locator('ul.products li.product')
		let i = 0
		let medicalProductExists = false
		let medicalCardProvided = false

		let productCount = await products.count()

		while (i <= productCount) {
			if (i >= productCount) {
				console.log(`Only ${productCount} products available on the page.`)
				if (!medicalProductExists) {
					throw new Error('No Medical Products found on this page/store/location')
				}
				break
			}

			const product = products.nth(i)
			const hasMedicalOnlyTag = (await product.locator('.wpse-metabadge.med-metabadge').count()) > 0

			if (hasMedicalOnlyTag) {
				medicalProductExists = true
			}

			if (!hasMedicalOnlyTag) {
				console.log(
					`Skipping product "${await product
						.locator('.woocommerce-loop-product__title')
						.innerText()}" as it is not "Medical Only".`,
				)
				i++
				continue
			}

			const addToCartButton = product.locator(
				'button.button.product_type_simple.fasd_to_cart.ajax_groove',
			)
			const productName = await product.locator('.woocommerce-loop-product__title').innerText()
			const productNameNormalized = productName.trim()

			// Add the product to the cart
			await addToCartButton.click()
			await page.waitForTimeout(3000)
			await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })

			const cartItem = page.locator(`td.product-name:has(a:has-text("${productNameNormalized}"))`)
			const isProductInCart = (await cartItem.count()) > 0

			if (!isProductInCart) {
				throw new Error(
					`Product "${productNameNormalized}" was not found in the cart after being added.`,
				)
			}

			console.log(`Product "${productNameNormalized}" was successfully added to the cart.`)

			// Check if the minimum banner is still visible
			const isMinimumBannerVisible = await this.minimumNotMetLabel.isVisible()
			if (!isMinimumBannerVisible) {
				console.log('Minimum cart total met. Proceeding to check for medical card requirements.')
				// View the cart
				await this.viewCartButtonSimple.waitFor({ state: 'visible' })
				await this.viewCartButtonSimple.click()
				//
				await page.waitForTimeout(3000)
				//
				// // Check if the Medical Card Banner is visible
				// const medicalOnlyBannerVisible = await page
				// 	.locator('.wpse-snacktoast.warn-toast.med-issue')
				// 	.isVisible()
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
				// // verify medical cart banner shows when medical product is in cart
				// try {
				// 	await expect(this.medicalOnlyBanner).toBeVisible()
				// } catch (error) {
				// 	throw new Error(
				// 		'Med Card Verification not working -- Cart Banner for Med Products not showing',
				// 	)
				// }
				if (isMedicalOnlyBannerCorrect && !medicalCardProvided) {
					console.log('Medical-only product in cart. Adding medical card information...')

					// Add the medical card information
					const medicalCardCheckbox = page.locator('input#med_included')
					await medicalCardCheckbox.check()

					const medCardFileInput = page.locator('input#fasd_medcard')
					const [fileChooser] = await Promise.all([
						page.waitForEvent('filechooser'),
						medCardFileInput.click(),
					])
					await fileChooser.setFiles('Medical-Card.png')

					// const issuingStateSelect = page.locator('select#medcard_state')
					// const expirationInput = page.locator('input#medcard_exp')
					await this.issuingStateSelect.selectOption('CA')
					const newYear = new Date().getFullYear() + 1
					await this.expirationInput.click()
					await this.expirationInput.type(`01/01/${newYear}`)

					const saveMedicalInfoButton = page.locator(
						'.fasd-form-submit:has-text("Save & Continue")',
					)
					await saveMedicalInfoButton.click()
					medicalCardProvided = true

					await page.waitForTimeout(3000)

					// View the cart
					await this.cartButtonNav.waitFor({ state: 'visible' })
					await this.cartButtonNav.click()
					await this.cartDrawerContainer.waitFor({ state: 'visible', timeout: 10000 })

					// Proceed to checkout
					console.log('All requirements met. Proceeding to Checkout.')
					await this.continueToCheckoutButton.waitFor({ state: 'visible' })
					await this.continueToCheckoutButton.click()
				}
				//
				// break loop if order minimum is met
				break
			}

			// Close the cart drawer and wait before adding another product
			await this.closeCartDrawerButton.click()
			await page.waitForTimeout(2000)

			//i++ // Increment to the next product
		}
	}

	async liveRecAddProductsToCartUntilMinimumMet(page) {
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
				await this.productPageAddToCartButton.waitFor({ state: 'visible' })
				await this.productPageAddToCartButton.first().click({ force: true })
				await page.waitForTimeout(5000)

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
	async liveMedAddProductsToCartUntilMinimumMet(page, envType) {
		// Get all the products on the page
		const products = await page.locator(
			'li.product.type-product.product-type-simple.status-publish',
		)

		let i = 4
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
				await this.productPageAddToCartButton.nth(0).waitFor({ state: 'visible' })
				await this.productPageAddToCartButton.nth(0).hover()
				await page.waitForTimeout(200)
				await this.productPageAddToCartButton.nth(0).click()
				await page.waitForTimeout(2000)
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
				await addToCartButton.click()
				await page.waitForTimeout(4000)

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
				await driversLicenseChooser.setFiles('Medical-Card.png')
				await issuingStateSelect.selectOption('CA')
				const newYear = new Date().getFullYear() + 1
				await expirationInput.click()
				await expirationInput.type(`01/01/${newYear}`)

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
		page,
		{ mode = 'concierge', productSelector, startIndex = 0, isMultiStore = false },
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
	async isMedicalProduct(product) {
		const count = await product.locator('.wpse-metabadge.med-metabadge').count()
		return count > 0
	}

	// 2) Log skipping message for non-medical product
	async logSkippingNonMedical(product) {
		const title = await product.locator('.woocommerce-loop-product__title').innerText()
		console.log(`Skipping product "${title.trim()}" as it is not "Medical Only".`)
	}

	// 3) Add the FIRST medical-only product in Live mode
	//    (where you click into product details, then add to cart)
	async addFirstMedicalProduct(page, product) {
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
	async addMedicalProductDirect(page, product, mode) {
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
	async verifyProductInCart(page, productName) {
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
	async goToCart(page) {
		await this.viewCartButtonSimple.waitFor({ state: 'visible' })
		await this.viewCartButtonSimple.click()
		// Possibly wait for the cart page or cart drawer to appear
		await page.waitForTimeout(2000)
	}

	// 7) Check medical-only banner and optionally upload med card info
	async checkMedicalBannerAndMaybeUploadCard(page, medicalCardProvided) {
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

	// 8) Continue Shopping in Live mode
	async continueShopping(page) {
		// Typically, you click something like "Add more items to continue"
		await this.cartContinueShoppingButton.waitFor({ state: 'visible' })
		await this.cartContinueShoppingButton.click()
		await page.waitForTimeout(2000)
	}
	async newConciergeMedAddProductsToCartUntilMinimumMet(page) {
		return this.medAddProductsToCartUntilMinimumMet(page, {
			mode: 'concierge',
			productSelector: 'ul.products li.product',
			startIndex: 0,
			isMultiStore: false,
		})
	}

	async newLiveMedAddProductsToCartUntilMinimumMet(page) {
		return this.medAddProductsToCartUntilMinimumMet(page, {
			mode: 'live',
			productSelector: 'li.product.type-product.product-type-simple.status-publish',
			startIndex: 4,
			isMultiStore: true,
		})
	}
}
module.exports = { HomePageActions }
