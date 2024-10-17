require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

export class HomePageActions {
	readonly page: Page
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
		this.pageTitleSelector = page.locator('span.site-header-group')
		this.homePageButton710 = page.locator('a[rel="home"] h1.site-title')
		this.accountButtonNav = page.locator('svg.icon.icon-account')
		this.cartButtonNav = page.locator('a.wpse-cart-openerize').first()
		this.addToCartButtonGeneral = page.locator('button[aria-label="Add product to cart"]')
		this.enterAddressButtonDesktop = page.locator('a.wpse-button-storenav.wpse-openerize').first()
		this.enterAddressButtonMobile = page.locator('a.wpse-button-storenav.wpse-openerize').nth(1)
		this.enterAddressButtonConciergeDesktop = page
			.locator('a.wpse-button-storenav.wpse-openerize.flflmnt-alert')
			.first()
		this.enterAddressButtonConciergeMobile = page
			.locator('a.wpse-button-storenav.wpse-openerize.flflmnt-alert')
			.nth(1)
		this.addressInfoSideBarContainer = page.locator('div.wpse-drawer[data-module="fulfillment"]')
		this.addressField = page.locator('#fasd_address')
		this.submitAddressButton = page.locator('button.wpse-button-primary.fasd-form-submit')
		this.cartDrawerContainer = page.locator('#cartDrawer')
		this.closeCartDrawerButton = page.locator(
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
	}
	async enterAddress(page, storeType) {
		await test.step('Click address button', async () => {
			const viewportSize = await page.viewportSize()
			if (storeType == 'concierge') {
				if (viewportSize.width <= 768) {
					// Mobile view Concierge
					await this.enterAddressButtonConciergeMobile.waitFor({ state: 'visible' })
					await expect(this.enterAddressButtonConciergeMobile).toBeVisible()
					await this.enterAddressButtonConciergeMobile.click()
				} else {
					// Desktop view Concierge
					await this.enterAddressButtonConciergeDesktop.waitFor({ state: 'visible' })
					await expect(this.enterAddressButtonConciergeDesktop).toBeVisible()
					await this.enterAddressButtonConciergeDesktop.click()
				}
			} else if (storeType == 'live') {
				if (viewportSize.width <= 768) {
					// Mobile view
					await this.enterAddressButtonMobile.waitFor({ state: 'visible' })
					await expect(this.enterAddressButtonMobile).toBeVisible()
					await this.enterAddressButtonMobile.click()
					//await expect(this.liveChangeAddressButton).toBeVisible()
					//await this.liveChangeAddressButton.click()
				} else {
					// Desktop view
					await this.enterAddressButtonDesktop.waitFor({ state: 'visible' })
					await expect(this.enterAddressButtonDesktop).toBeVisible()
					await this.enterAddressButtonDesktop.click()
					// await expect(this.liveChangeAddressButton).toBeVisible()
					// await this.liveChangeAddressButton.click()
				}
			}
		})
		await test.step('Enter address info into field', async () => {
			//verify address sidebar container AND address field are visible
			await this.addressInfoSideBarContainer.waitFor({ state: 'visible' })
			await expect(this.addressInfoSideBarContainer).toBeVisible()
			await expect(this.addressField).toBeVisible()

			const address = '440 Rodeo Drive Beverly Hills'

			// Type the address into the text field
			await this.addressField.fill(address)

			// Wait for the autocomplete suggestions to appear
			await this.page.waitForSelector('.pac-item') // Replace with the actual class or selector of the autocomplete suggestion items

			// Press 'ArrowDown' to navigate to the first suggestion and then press 'Enter' to select it
			await this.addressField.press('ArrowDown')
			await this.addressField.press('Enter')
		})
		await test.step('Click submit button', async () => {
			await this.page.waitForTimeout(1500)
			await expect(this.submitAddressButton).toBeVisible()
			await this.submitAddressButton.click()
			await this.page.waitForTimeout(1500)
			// verify that address sidebar dissappears after submitting address
			// await this.addressInfoSideBarContainer.waitFor({ state: 'hidden' })
			// await expect(this.addressField).toBeHidden()
			//await this.addressInfoSideBarContainer.waitFor({ state: 'hidden' })
		})
	}
	async randomizeCartItems() {
		return Math.random() * (2 - -2 + -2)
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

	async addProductsToCartUntilMinimumMet(page) {
		// Get all the products on the page
		const products = await page.locator('ul.products li.product')

		let i = 0
		while (true) {
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
			await this.cartDrawerContainer.waitFor({ state: 'visible' })

			// Verify that the product was added to the cart by checking the cartDrawer
			const cartItem = await page.locator(
				`#cartDrawer .woocommerce-cart-form__cart-item .product-name a:has-text("${productName}")`,
			)
			const isProductInCart = (await cartItem.count()) > 0

			if (!isProductInCart) {
				throw new Error(`Product "${productName}" was not found in the cart after being added.`)
			}

			console.log(`Product "${productName}" was successfully added to the cart.`)

			// Check if the "Delivery minimum not met" banner is still visible
			const isBannerVisible = await this.minimumNotMetLabel.isVisible()

			if (!isBannerVisible) {
				console.log('Minimum cart total met. Proceeding to checkout.')
				//break out of loop to continue in the cart
				break
			}

			// Close the cartDrawer
			await this.closeCartDrawerButton.click()
			// Wait for the cartDrawer to be hidden again
			await this.cartDrawerContainer.waitFor({ state: 'visible' })

			// Optionally, wait before adding the next product to account for any animations or delays
			await page.waitForTimeout(1000) // Adjust this timeout based on your app's behavior

			i++ // Increment to the next product
		}

		// Once the banner is no longer visible, proceed to click the "Continue to checkout" button
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}
	async recAddProductsToCartUntilMinimumMet(page) {
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
			const addToCartButton = product.locator('button.add_to_cart_button')
			const productName = await product.locator('.woocommerce-loop-product__title').innerText()

			// Click the 'Add to Cart' button
			console.log('locator for addtoCartButton: ' + addToCartButton)
			//await page.waitForSelector(addToCartButton)
			await expect(addToCartButton).toBeVisible()
			//
			// Use evaluate to perform custom scrolling with offset
			// const elementLocator = page.locator(
			// 	'li.product.type-product.product-type-simple.status-publish button.add_to_cart_button',
			// )
			// const elementLocator = addToCartButton
			// await elementLocator.evaluate(element => {
			// 	const elementRect = element.getBoundingClientRect()
			// 	const offsetTop = elementRect.top + window.scrollY

			// 	// Calculate offset to center the element in the viewport
			// 	const offsetPosition = offsetTop - window.innerHeight / 3 + elementRect.height / 3

			// 	// Scroll to the calculated position
			// 	window.scrollTo({
			// 		top: offsetPosition,
			// 		behavior: 'smooth', // This provides a smooth scrolling effect
			// 	})
			// })
			//
			//await addToCartButton.scrollIntoViewIfNeeded()
			await addToCartButton.click()
			//product page add to cart
			//await this.productPageAddToCartButton.waitFor({ state: 'visible' })
			//await this.productPageAddToCartButton.click()

			await page.waitForTimeout(4000)

			// Wait for the cartDrawer to become visible
			await this.cartDrawerContainer.waitFor({ state: 'visible' })

			// Verify that the product was added to the cart by checking the cartDrawer
			const cartItem = await page.locator(
				`#cartDrawer .woocommerce-cart-form__cart-item .product-name a:has-text("${productName}")`,
			)
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
			//
			//
			// await this.homePageButton710.waitFor({ state: 'visible' })
			// await this.homePageButton710.click()

			i++ // Increment to the next product
		}

		// Once the banner is no longer visible, proceed to click the "Continue to checkout" button
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}

	// function to only add MED-only products to a cart in order to test MED users
	// function searches for med-only products with the med tag, adds that product to cart,
	// checks if Med card needs to be added, adds the med card, and then verifies if cart minimum is reached
	// adding the same med-only product to cart until the min is reached
	async medAddProductsToCartUntilMinimumMet(page) {
		// Get all the products on the page
		const products = await page.locator('ul.products li.product')

		let i = 0
		let medicalCardProvided = false

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

			//search for product with a MED only tag, so that we can use that product to add to cart for Med user
			if (!hasMedicalOnlyTag) {
				// Skip the product if it does not have the "Medical Only" tag
				console.log(
					`Skipping product "${await product
						.locator('.woocommerce-loop-product__title')
						.innerText()}" as it is not "Medical Only".`,
				)
				i++
				continue // Skip this product and move to the next one
			}

			// Get the 'Add to Cart' button and product name for the current product
			const addToCartButton = product.locator('button.add_to_cart_button')
			const productName = await product.locator('.woocommerce-loop-product__title').innerText()

			// Click the 'Add to Cart' button
			await addToCartButton.click()
			await page.waitForTimeout(4000)

			// Wait for the cartDrawer to become visible
			await this.cartDrawerContainer.waitFor({ state: 'visible' })

			// Verify that the product was added to the cart by checking the cartDrawer
			const cartItem = await page.locator(
				`#cartDrawer .woocommerce-cart-form__cart-item .product-name a:has-text("${productName}")`,
			)
			const isProductInCart = (await cartItem.count()) > 0

			if (!isProductInCart) {
				throw new Error(`Product "${productName}" was not found in the cart after being added.`)
			}

			console.log(`Product "${productName}" was successfully added to the cart.`)

			//if medical card info is already provided, then check if cart minimum has been reached yet
			if (medicalCardProvided) {
				// Check if the "Delivery minimum not met" banner is still visible
				const isBannerVisible = await this.minimumNotMetLabel.isVisible()

				if (!isBannerVisible) {
					console.log('Minimum cart total met. Proceeding to checkout.')
					// Break out of loop to continue in the cart
					break
				}
				// Close the cartDrawer
				await this.closeCartDrawerButton.click()
				await page.waitForTimeout(2000)
			}

			// Check if the "Medical Only" banner is visible
			const medicalOnlyBannerVisible = await page
				.locator('.wpse-snacktoast.warn-toast.med-issue')
				.isVisible()
			if (medicalOnlyBannerVisible && !medicalCardProvided) {
				console.log('Medical-only product in cart. Adding medical card information...')

				// Click the "I have a medical card" checkbox
				const medicalCardCheckbox = page.locator('input#med_included')
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
				// await issuingStateSelect.selectOption('CA')
				const newYear = new Date().getFullYear() + 1
				await expirationInput.click()
				await expirationInput.type(`01/01/${newYear}`)
				// await expirationInput.fill(`01/01/${newYear}`) // Set the expiration date to a future date

				// Submit the medical card information
				const saveMedicalInfoButton = page.locator('.fasd-form-submit:has-text("Save & Continue")')
				await saveMedicalInfoButton.click()

				// Set the flag to true since the medical card has been provided
				medicalCardProvided = true

				// Wait for any animations or loading to finish
				await page.waitForTimeout(3000)
			}

			//DOES NOT increment to next product in order to add the same MED Only product
			//i++ // Increment to the next product
		}

		// Once the banner is no longer visible, proceed to click the "Continue to checkout" button
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}

	async goToCheckout() {
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}

	async liveRecAddProductsToCartUntilMinimumMet(page) {
		// Get all the products on the page
		const products = await page.locator(
			'li.product.type-product.product-type-simple.status-publish',
		)

		let i = 4
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
				await this.productPageAddToCartButton.click()
				await page.waitForTimeout(4000)

				// Wait for the cart drawer to become visible
				await this.cartDrawerContainer.waitFor({ state: 'visible' })

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
	async liveMedAddProductsToCartUntilMinimumMet(page) {
		// Get all the products on the page
		const products = await page.locator(
			'li.product.type-product.product-type-simple.status-publish',
		)

		let i = 0
		let firstMedicalProductAdded = false // Track if the first product added is a medical product
		let medicalCardProvided = false

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

			if (!firstMedicalProductAdded && hasMedicalOnlyTag) {
				// Add the first Medical-Only product to the cart
				const productName = await product.locator('.woocommerce-loop-product__title').innerText()
				const productClickInto = product.locator('img.woocommerce-placeholder.wp-post-image')

				console.log('Adding first medical-only product: ' + productName)
				await expect(productClickInto).toBeVisible()
				await productClickInto.click()

				// Wait for and click 'Add to Cart' on the product page
				await this.productPageAddToCartButton.waitFor({ state: 'visible' })
				await this.productPageAddToCartButton.click()
				await page.waitForTimeout(4000)

				// Wait for the cart drawer to become visible
				await this.cartDrawerContainer.waitFor({ state: 'visible' })

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

		// Check for the Medical Info banner and add medical card info
		const medicalOnlyBannerVisible = await page
			.locator('.wpse-snacktoast.warn-toast.med-issue')
			.isVisible()

		if (medicalOnlyBannerVisible && !medicalCardProvided) {
			console.log('Medical-only product in cart. Adding medical card information...')

			// Click the "I have a medical card" checkbox
			const medicalCardCheckbox = page.locator('input#med_included')
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

		// Proceed to checkout after medical info is provided
		await this.continueToCheckoutButton.waitFor({ state: 'visible' })
		await expect(this.continueToCheckoutButton).toBeVisible()
		await this.continueToCheckoutButton.click()
	}
}
module.exports = { HomePageActions }
