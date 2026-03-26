async function TheListImageUploads(page, vuContext, events, test) {
	function randomFirstName() {
		const firstNames = [
			'LoadTest_James',
			'LoadTest_John',
			'LoadTest_Robert',
			'LoadTest_Michael',
			'LoadTest_William',
			'LoadTest_David',
			'LoadTest_Richard',
			'LoadTest_Joseph',
			'LoadTest_Charles',
			'LoadTest_Thomas',
			'LoadTest_Christopher',
			'LoadTest_Daniel',
			'LoadTest_Matthew',
			'LoadTest_Anthony',
			'LoadTest_Donald',
			'LoadTest_Mark',
			'LoadTest_Paul',
			'LoadTest_Steven',
			'LoadTest_Andrew',
			'LoadTest_Kenneth',
			'LoadTest_Joshua',
			'LoadTest_Kevin',
			'LoadTest_Brian',
			'LoadTest_George',
			'LoadTest_Edward',
			'LoadTest_Ronald',
			'LoadTest_Timothy',
			'LoadTest_Jason',
			'LoadTest_Jeffrey',
			'LoadTest_Ryan',
			'LoadTest_Lisa',
			'LoadTest_Mary',
			'LoadTest_Karen',
			'LoadTest_Patricia',
			'LoadTest_Sandra',
			'LoadTest_Kimberly',
			'LoadTest_Donna',
			'LoadTest_Michelle',
			'LoadTest_Elizabeth',
			'LoadTest_Susan',
			'LoadTest_Jessica',
			'LoadTest_Sarah',
			'LoadTest_Nancy',
			'LoadTest_Jennifer',
			'LoadTest_Maria',
			'LoadTest_Melissa',
			'LoadTest_Emily',
			'LoadTest_Amanda',
			'LoadTest_Hannah',
			'LoadTest_Ashley',
		]

		const randomIndex = Math.floor(Math.random() * firstNames.length)
		return firstNames[randomIndex]
	}

	function randomLastName() {
		const lastNames = [
			'LoadTest_Smith',
			'LoadTest_Johnson',
			'LoadTest_Williams',
			'LoadTest_Brown',
			'LoadTest_Jones',
			'LoadTest_Garcia',
			'LoadTest_Miller',
			'LoadTest_Davis',
			'LoadTest_Rodriguez',
			'LoadTest_Martinez',
			'LoadTest_Hernandez',
			'LoadTest_Lopez',
			'LoadTest_Gonzalez',
			'LoadTest_Wilson',
			'LoadTest_Anderson',
			'LoadTest_Thomas',
			'LoadTest_Taylor',
			'LoadTest_Moore',
			'LoadTest_Jackson',
			'LoadTest_Martin',
			'LoadTest_Lee',
			'LoadTest_Perez',
			'LoadTest_Thompson',
			'LoadTest_White',
			'LoadTest_Harris',
			'LoadTest_Sanchez',
			'LoadTest_Clark',
			'LoadTest_Ramirez',
			'LoadTest_Lewis',
			'LoadTest_Robinson',
			'LoadTest_Walker',
			'LoadTest_Young',
			'LoadTest_Allen',
			'LoadTest_King',
			'LoadTest_Wright',
			'LoadTest_Scott',
			'LoadTest_Torres',
			'LoadTest_Nguyen',
			'LoadTest_Hill',
			'LoadTest_Flores',
			'LoadTest_Green',
			'LoadTest_Adams',
			'LoadTest_Nelson',
			'LoadTest_Baker',
			'LoadTest_Hall',
			'LoadTest_Rivera',
			'LoadTest_Campbell',
			'LoadTest_Mitchell',
			'LoadTest_Carter',
			'LoadTest_Roberts',
		]

		const randomIndex = Math.floor(Math.random() * lastNames.length)
		return lastNames[randomIndex]
	}

	function randomNumber() {
		return Math.floor(Math.random() * 900000) + 100000
	}

	function randomPhoneNumber() {
		const areaCode = '555'
		const middlePart = Math.floor(Math.random() * 1000)
			.toString()
			.padStart(3, '0')
		const lastPart = Math.floor(Math.random() * 10000)
			.toString()
			.padStart(4, '0')
		return `${areaCode}-${middlePart}-${lastPart}`
	}

	function getRandomUsageType() {
		const randomNumber = Math.random()

		return randomNumber < 0.5 ? 'Medical' : 'Recreational'
	}

	function getRandomFulfillmentType() {
		const randomNumber = Math.random()

		return randomNumber < 0.5 ? 'Pickup' : 'Delivery'
	}

	function getCartCount() {
		return 3
	}

	const { step } = test
	const userid = vuContext.vars.userid
	const recordid = vuContext.vars.recordid
	const userFirstName = randomFirstName()
	const userLastName = randomLastName()
	const userEmail = `loadtest-${userFirstName.toLowerCase()}.${userLastName.toLowerCase()}.${randomNumber()}@loadtest.com`
	const userAddress = '3377 S La Cienega Blvd, Los Angeles, CA 90016'
	const usageType = getRandomUsageType()
	const fulfillmentType = getRandomFulfillmentType()
	const itemCount = getCartCount()
	const target = vuContext.vars.target || 'https://thelist-dev.710labs.com'

	// Inject VIP cookie before navigation
	await page.context().addCookies([
		{
			name: 'vipChecker',
			value: '3',
			domain: new URL(target).hostname,
			path: '/',
		},
	])

	await step('Pass Age Gate', async () => {
		console.log(`[DEBUG] Starting Age Gate. URL: ${page.url()}, Title: ${await page.title()}`)
		await step('Load 710 Labs ', async () => {
			await page.goto(target)
			console.log(`[DEBUG] Page Loaded. URL: ${page.url()}, Title: ${await page.title()}`)
		})

		await step('Click Age Gate Acceptance', async () => {
			await page
				.getByRole('button', { name: "I'm over 21 or a qualified patient" })
				.click({ timeout: 60000 })
		})
	})

	await step('Enter List Password', async () => {
		console.log(`[DEBUG] Entering List Password. URL: ${page.url()}`)
		await step('Type and Submit List Password', async () => {
			const passwordField = await page.locator('input[name="post_password"]')
			await passwordField.click()
			await passwordField.fill(process.env.ARTILLERY_LIST_PASSWORD)
			await page.click('text=enter site')
			console.log(`[DEBUG] Password Submitted. URL: ${page.url()}`)
		})
	})

	await step('Create Account ', async () => {
		console.log(`[DEBUG] Starting Account Creation. URL: ${page.url()}`)
		await step('Enter Account Info', async () => {
			await step('Click Register Link', async () => {
				await page.click('text=create an account')
				console.log(`[DEBUG] On Registration Page. URL: ${page.url()}`)
			})

			await step('Enter First Name', async () => {
				const firstName = page.locator('input[name="svntn_core_registration_firstname"]')
				await firstName.click()
				await firstName.fill(userFirstName)
			})

			await step('Enter Last Name', async () => {
				const lastName = page.locator('input[name="svntn_core_registration_lastname"]')
				await lastName.click()
				await lastName.fill(userLastName)
			})

			await step('Enter Email', async () => {
				const emailField = await page.locator('input[name="email"]')
				await emailField.click()
				await emailField.fill(userEmail)
			})

			await step('Enter Password', async () => {
				const passwordField = page.locator('input[name="password"]')
				await passwordField.click()
				await passwordField.fill(userEmail)
			})

			await step('Enter Birthdate', async () => {
				const birthMonth = page.locator('select[name="svntn_core_dob_month"]')
				const birthDay = page.locator('select[name="svntn_core_dob_day"]')
				const birthYear = page.locator('select[name="svntn_core_dob_year"]')
				await birthMonth.selectOption('12')
				await birthDay.selectOption('16')
				await birthYear.selectOption('1988')
			})

			await step('Enter Billing Address', async () => {
				const address = page.locator('input[name="billing_address_1"]')
				await address.click()
				await address.fill(userAddress)
				await page.waitForTimeout(1000)
				await page.keyboard.press('ArrowDown')
				await page.keyboard.press('Enter')
			})

			await step('Enter Phone Number', async () => {
				const phoneNumber = page.locator('input[name="billing_phone"]')
				await phoneNumber.click()
				await phoneNumber.fill(randomPhoneNumber())
			})

			await step('Submit New Customer Form', async () => {
				await page.waitForTimeout(2000)
				await page.click('button:has-text("Next")')
				await page.waitForTimeout(1000)
			})
		})

		await step('Enter Validation Info', async () => {
			await step('Submit Drivers License', async () => {
				await step('Upload DL File', async () => {
					const dlUploadButton = await page.waitForSelector('input[name="svntn_core_personal_doc"]')
					const [driversLicenseChooser] = await Promise.all([
						page.waitForEvent('filechooser'),
						dlUploadButton.click(),
					])
					await page.waitForTimeout(5000)
					await driversLicenseChooser.setFiles('CA-DL.jpg')
					await page.waitForTimeout(5000)
				})
				await step('Enter DL Exp', async () => {
					const driversLicenseExpMonth = await page.waitForSelector(
						'select[name="svntn_core_pxp_month"]',
					)
					const driversLicenseExpDay = await page.waitForSelector(
						'select[name="svntn_core_pxp_day"]',
					)
					const driversLicenseExpYear = await page.waitForSelector(
						'select[name="svntn_core_pxp_year"]',
					)

					await driversLicenseExpMonth.selectOption('12')
					await driversLicenseExpDay.selectOption('16')
					await driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
				})
			})
			if (usageType === 'Medical') {
				await step('Submit Med Card', async () => {
					await step('Select Usage Type Medical', async () => {
						await page.getByLabel('Medical', { exact: true }).check()
					})
					await step('Upload Med Card File', async () => {
						const medCardUploadButton = await page.waitForSelector(
							'input[name="svntn_core_medical_doc"]',
						)
						const [medicalCardChooser] = await Promise.all([
							page.waitForEvent('filechooser'),
							medCardUploadButton.click(),
						])
						await page.waitForTimeout(5000)
						await medicalCardChooser.setFiles('Medical-Card.png')
						await page.waitForTimeout(5000)
					})
					await step('Enter Medical Card Exp', async () => {
						const medicalCardExpMonth = await page.waitForSelector(
							'select[name="svntn_core_mxp_month"]',
						)
						const medicalCardExpDay = await page.waitForSelector(
							'select[name="svntn_core_mxp_day"]',
						)
						const medicalCardExpYear = await page.waitForSelector(
							'select[name="svntn_core_mxp_year"]',
						)

						await medicalCardExpMonth.selectOption('12')
						await medicalCardExpDay.selectOption('16')
						await medicalCardExpYear.selectOption(`${new Date().getFullYear() + 1}`)
					})
					await step('Add Medical Card Number', async () => {
						const medicalCardNumber = page.locator('input[name="svntn_mno"]')
						await medicalCardNumber.click()
						await medicalCardNumber.fill('123456789')
					})
				})
			}

			await step('Submit Validation Info', async () => {
				await page.getByRole('button', { name: 'Register' }).click()
				await page.waitForTimeout(5000)
			})
		})
		await step('Select Fulfillment Type', async () => {
			await step(`Select ${fulfillmentType}`, async () => {
				await page
					.locator('#fulfillmentElement')
					.getByText(fulfillmentType, { exact: true })
					.click()
			})
			await step(`Submit ${fulfillmentType} Fulfillment`, async () => {
				await page.getByRole('button', { name: 'Submit' }).click()
			})
		})
	})

	await step('Create Cart', async () => {
		await step('Add Items To Cart', async () => {
			await page.waitForTimeout(5000)
			var addToCartButtons
			if (usageType === 'Recreational') {
				await page.waitForSelector(
					'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test")) and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]',
				)
				await page.waitForTimeout(5000)
				addToCartButtons = await page.locator(
					'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test")) and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]',
				)
			} else {
				await page.waitForSelector(
					'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test"))]//a[contains(@aria-label, "Add to cart:")]',
				)
				await page.waitForTimeout(5000)
				addToCartButtons = await page.locator(
					'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test"))]//a[contains(@aria-label, "Add to cart:")]',
				)
			}

			const indices = Array.from({ length: itemCount }, (_, index) => index)

			for (let i = indices.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1))
				;[indices[i], indices[j]] = [indices[j], indices[i]]
			}

			for (const index of indices) {
				await addToCartButtons.nth(index).click({ force: true })
				await page.waitForTimeout(2000)
			}
		})
		// await step('Add Promo Item To Cart', async () => {
		// 	await page.waitForTimeout(5000)
		// 	var addToCartButtons

		// 	if (usageType === 'Recreational') {
		// 		await page.waitForSelector(
		// 			'//li[contains(@class, "product_cat-woo-import-test") and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]',
		// 		)
		// 		await page.waitForTimeout(5000)
		// 		addToCartButtons = await page.locator(
		// 			'//li[contains(@class, "product_cat-woo-import-test") and not(.//h2[contains(@class, "woocommerce-loop-product__title") and .//span[contains(@class, "medOnly")]])]//a[contains(@aria-label, "Add to cart:")]',
		// 		)
		// 	} else {
		// 		await page.waitForSelector(
		// 			'//li[contains(@class, "product_cat-woo-import-test")]//a[contains(@aria-label, "Add to cart:")]',
		// 		)
		// 		await page.waitForTimeout(5000)
		// 		addToCartButtons = await page.locator(
		// 			'//li[contains(@class, "product_cat-woo-import-test")]//a[contains(@aria-label, "Add to cart:")]',
		// 		)
		// 	}

		// 	const indices = Array.from({ length: 2 }, (_, index) => index)

		// 	for (let i = indices.length - 1; i > 0; i--) {
		// 		const j = Math.floor(Math.random() * (i + 1))
		// 		;[indices[i], indices[j]] = [indices[j], indices[i]]
		// 	}

		// 	await step('Choose Promo Item', async () => {
		// 		await addToCartButtons.nth(0).click({ force: true })
		// 		await page.waitForTimeout(2000)
		// 	})

		// 	await step('Validate Promo Restrictions ', async () => {
		// 		await addToCartButtons.nth(1).click({ force: true })
		// 		await page.waitForTimeout(2000)
		// 		await page.waitForSelector('.notyf__dismiss-btn')
		// 		await page.locator('.notyf__dismiss-btn').click()
		// 	})
		// })

		await step('Review Cart', async () => {
			console.log(`[DEBUG] Reviewing Cart. URL: ${page.url()}`)
			await step('Navigate To Cart', async () => {
				await page.locator('a.cart-contents').click()
				console.log(`[DEBUG] In Cart. URL: ${page.url()}`)
			})
			await step('Navigate To Checkout', async () => {
				await page.locator('.checkout-button').click()
				console.log(`[DEBUG] At Checkout. URL: ${page.url()}`)
			})
		})
	})

	await step('Checkout Cart', async () => {
		console.log(`[DEBUG] Starting Checkout. URL: ${page.url()}`)
		await step('Enter Fulfillment Info', async () => {
			await step('Select Acuity Slot', async () => {
				await page.waitForTimeout(2000)
				const errorMessage = page.locator('#datetimeError')

				if (!(await errorMessage.isVisible())) {
					await page.waitForSelector('#svntnAcuityDayChoices >> .acuityChoice', {
						timeout: 45 * 1000,
					})

					const daySlot = page.locator('#svntnAcuityDayChoices >> .acuityChoice').first()
					await daySlot.click()

					await page.waitForSelector('#svntnAcuityTimeChoices >> .acuityChoice')

					const timeSlot = page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first()
					await timeSlot.click()
				}
			})
		})

		await step('Complete Order', async () => {
			const placeOrderButton = page.locator('id=place_order')
			await placeOrderButton.waitFor({ state: 'visible' })
			await placeOrderButton.click()
		})
	})
}

module.exports = {
	TheListImageUploads,
}
