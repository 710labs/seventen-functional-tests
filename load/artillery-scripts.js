async function CA(page, vuContext, events, test) {
	function randomFirstName() {
		const firstNames = [
			'James',
			'John',
			'Robert',
			'Michael',
			'William',
			'David',
			'Richard',
			'Joseph',
			'Charles',
			'Thomas',
			'Christopher',
			'Daniel',
			'Matthew',
			'Anthony',
			'Donald',
			'Mark',
			'Paul',
			'Steven',
			'Andrew',
			'Kenneth',
			'Joshua',
			'Kevin',
			'Brian',
			'George',
			'Edward',
			'Ronald',
			'Timothy',
			'Jason',
			'Jeffrey',
			'Ryan',
			'Lisa',
			'Mary',
			'Karen',
			'Patricia',
			'Sandra',
			'Kimberly',
			'Donna',
			'Michelle',
			'Elizabeth',
			'Susan',
			'Jessica',
			'Sarah',
			'Nancy',
			'Jennifer',
			'Maria',
			'Melissa',
			'Emily',
			'Amanda',
			'Hannah',
			'Ashley',
		]

		const randomIndex = Math.floor(Math.random() * firstNames.length)
		return firstNames[randomIndex]
	}

	function randomLastName() {
		const lastNames = [
			'Smith',
			'Johnson',
			'Williams',
			'Brown',
			'Jones',
			'Garcia',
			'Miller',
			'Davis',
			'Rodriguez',
			'Martinez',
			'Hernandez',
			'Lopez',
			'Gonzalez',
			'Wilson',
			'Anderson',
			'Thomas',
			'Taylor',
			'Moore',
			'Jackson',
			'Martin',
			'Lee',
			'Perez',
			'Thompson',
			'White',
			'Harris',
			'Sanchez',
			'Clark',
			'Ramirez',
			'Lewis',
			'Robinson',
			'Walker',
			'Young',
			'Allen',
			'King',
			'Wright',
			'Scott',
			'Torres',
			'Nguyen',
			'Hill',
			'Flores',
			'Green',
			'Adams',
			'Nelson',
			'Baker',
			'Hall',
			'Rivera',
			'Campbell',
			'Mitchell',
			'Carter',
			'Roberts',
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
		const randomDecimal = Math.random()
		const randomNumber = Math.floor(randomDecimal * 5) + 5
		return randomNumber
	}

	const { step } = test
	const userid = vuContext.vars.userid
	const recordid = vuContext.vars.recordid
	const userFirstName = randomFirstName()
	const userLastName = randomLastName()
	const userEmail = `${userFirstName.toLowerCase()}.${userLastName.toLowerCase()}.${randomNumber()}@mail7.io`
	const userAddress = '3377 S La Cienega Blvd, Los Angeles, CA 90016'
	const usageType = getRandomUsageType()
	const fulfillmentType = getRandomFulfillmentType()
	const itemCount = getCartCount()

	await step('Pass Age Gate', async () => {
		await step('Load 710 Labs ', async () => {
			await page.goto('https://thelist-stage.710labs.com')
		})

		// await step('Click Age Gate Acceptance', async () => {
		// 	await page
		// 		.getByRole('button', { name: "I'm over 21 or a qualified" })
		// 		.click({ timeout: 60000 })
		// })
	})

	await step('Enter List Password', async () => {
		await step('Type and Submit List Password', async () => {
			const passwordField = await page.locator('input[name="post_password"]')
			await passwordField.click()
			await passwordField.fill('qatester')
			await page.click('text=enter site')
		})
	})

	await step('Create Account ', async () => {
		await step('Enter Account Info', async () => {
			await step('Click Register Link', async () => {
				await page.click('text=create an account')
			})

			await step('Enter Username', async () => {
				const userNameField = await page.locator('input[name="email"]')
				await userNameField.click()
				await userNameField.fill(userEmail)
			})

			await step('Enter Passowrd', async () => {
				const passwordField = page.locator('input[name="password"]')
				await passwordField.click()
				await passwordField.fill(userEmail)
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
					await driversLicenseChooser.setFiles('artillery/CA-DL.jpg')
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
						await medicalCardChooser.setFiles('artillery/Medical-Card.png')
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
			const addToCartButtons = await page.locator(
				'a.button.product_type_simple.add_to_cart_button.ajax_add_to_cart',
			)

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
		await step('Review Cart', async () => {
			await step('Navigate To Cart', async () => {
				await page.locator('a.cart-contents').click()
			})
			await step('Navigate To Checkout', async () => {
				await page.getByRole('link', { name: 'Continue to checkout ' }).click()
			})
		})
	})

	await step('Checkout Cart', async () => {
		await step('Enter Fulfillment Info', async () => {
			await step('Select Slot Day', async () => {
				const daySlots = page.locator('#svntnAcuityDayChoices label.acuityChoice')

				const daySlotCount = await daySlots.count()

				const randomIndex = Math.floor(Math.random() * daySlotCount)

				const daySlot = await daySlots.nth(randomIndex)

				await daySlot.click()
			})
			await step('Select Slot Time', async () => {
				const timeSlots = page.locator('#svntnAcuityTimeChoices label.acuityChoice')

				const timeSlotCount = await timeSlots.count()

				const randomIndex = Math.floor(Math.random() * timeSlotCount)

				const timeSlot = await timeSlots.nth(randomIndex)

				await timeSlot.click()
			})
		})

		await step('Complete Order', async () => {
			await page.getByRole('button', { name: 'Place your order' }).click()
		})
	})
}

async function CO(page) {}

async function MI(page) {}

module.exports = {
	CA,
	CO,
	MI,
}
