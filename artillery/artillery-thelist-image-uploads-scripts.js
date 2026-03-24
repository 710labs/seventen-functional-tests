const personalDocImages = ['CA-DL.jpg', 'CA-DL.png', 'CA-DL.heic']
const medicalCardImages = ['Medical-Card.jpeg', 'Medical-Card.png', 'Medical-Card.heic']

function randomFrom(values) {
	return values[Math.floor(Math.random() * values.length)]
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

function randomFulfillmentType() {
	return Math.random() < 0.5 ? 'Pickup' : 'Delivery'
}

async function uploadSequence(step, page, inputSelector, files, label) {
	const input = page.locator(inputSelector)
	await input.waitFor({ state: 'attached', timeout: 30000 })

	for (const file of files) {
		await step(`${label}: ${file}`, async () => {
			await input.setInputFiles(file)
			await page.waitForTimeout(1500)
		})
	}
}

async function TheListImageUploads(page, vuContext, events, test) {
	const { step } = test
	const userFirstName = randomFrom([
		'LoadTest_James',
		'LoadTest_John',
		'LoadTest_Robert',
		'LoadTest_Michael',
		'LoadTest_William',
	])
	const userLastName = randomFrom([
		'LoadTest_Smith',
		'LoadTest_Johnson',
		'LoadTest_Williams',
		'LoadTest_Brown',
		'LoadTest_Jones',
	])
	const userEmail = `loadtest-${userFirstName.toLowerCase()}.${userLastName.toLowerCase()}.${randomNumber()}@loadtest.com`
	const userAddress = '3377 S La Cienega Blvd, Los Angeles, CA 90016'
	const usageType = 'Medical'
	const fulfillmentType = randomFulfillmentType()
	const itemCount = 3
	const target = vuContext.vars.target || process.env.ARTILLERY_TARGET || 'https://thelist-dev.710labs.com'

	await page.context().addCookies([
		{
			name: 'vipChecker',
			value: '3',
			domain: new URL(target).hostname,
			path: '/',
		},
	])

	await step('Pass Age Gate', async () => {
		await page.goto(target)
		await page
			.getByRole('button', { name: "I'm over 21 or a qualified patient" })
			.click({ timeout: 60000 })
	})

	await step('Enter List Password', async () => {
		const listPassword = process.env.ARTILLERY_LIST_PASSWORD
		if (!listPassword) {
			throw new Error('ARTILLERY_LIST_PASSWORD environment variable is not set')
		}
		const passwordField = page.locator('input[name="post_password"]')
		await passwordField.click()
		await passwordField.fill(listPassword)
		await page.click('text=enter site')
	})

	await step('Create Account', async () => {
		await step('Enter Account Info', async () => {
			await page.click('text=create an account')
			await page.locator('input[name="svntn_core_registration_firstname"]').fill(userFirstName)
			await page.locator('input[name="svntn_core_registration_lastname"]').fill(userLastName)
			await page.locator('input[name="email"]').fill(userEmail)
			await page.locator('input[name="password"]').fill(userEmail)

			const birthMonth = page.locator('select[name="svntn_core_dob_month"]')
			const birthDay = page.locator('select[name="svntn_core_dob_day"]')
			const birthYear = page.locator('select[name="svntn_core_dob_year"]')
			await birthMonth.selectOption('12')
			await birthDay.selectOption('16')
			await birthYear.selectOption('1988')

			const address = page.locator('input[name="billing_address_1"]')
			await address.fill(userAddress)
			await page.waitForTimeout(1000)
			await page.keyboard.press('ArrowDown')
			await page.keyboard.press('Enter')

			await page.locator('input[name="billing_phone"]').fill(randomPhoneNumber())
			await page.waitForTimeout(2000)
			await page.click('button:has-text("Next")')
			await page.waitForTimeout(1000)
		})

		await step('Enter Validation Info', async () => {
			await step('Upload Personal Document Loop', async () => {
				await uploadSequence(
					step,
					page,
					'input[name="svntn_core_personal_doc"]',
					personalDocImages,
					'Personal doc upload',
				)
			})

			await step('Enter DL Exp', async () => {
				await page.locator('select[name="svntn_core_pxp_month"]').selectOption('12')
				await page.locator('select[name="svntn_core_pxp_day"]').selectOption('16')
				await page
					.locator('select[name="svntn_core_pxp_year"]')
					.selectOption(`${new Date().getFullYear() + 1}`)
			})

			await step('Select Usage Type Medical', async () => {
				await page.getByLabel('Medical', { exact: true }).check()
			})

			await step('Upload Medical Card Loop', async () => {
				await uploadSequence(
					step,
					page,
					'input[name="svntn_core_medical_doc"]',
					medicalCardImages,
					'Medical card upload',
				)
			})

			await step('Enter Medical Card Exp', async () => {
				await page.locator('select[name="svntn_core_mxp_month"]').selectOption('12')
				await page.locator('select[name="svntn_core_mxp_day"]').selectOption('16')
				await page
					.locator('select[name="svntn_core_mxp_year"]')
					.selectOption(`${new Date().getFullYear() + 1}`)
			})

			await step('Submit Validation Info', async () => {
				await page.getByRole('button', { name: 'Register' }).click()
				await page.waitForTimeout(5000)
			})
		})

		await step('Select Fulfillment Type', async () => {
			await page.locator('#fulfillmentElement').getByText(fulfillmentType, { exact: true }).click()
			await page.getByRole('button', { name: 'Submit' }).click()
		})
	})

	await step('Create Cart', async () => {
		let addToCartButtons
		await page.waitForTimeout(5000)
		await page.waitForSelector(
			'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test"))]//a[contains(@aria-label, "Add to cart:")]',
		)
		addToCartButtons = page.locator(
			'//li[contains(@class, "product") and not(contains(@class, "product_cat-woo-import-test"))]//a[contains(@aria-label, "Add to cart:")]',
		)

		for (let index = 0; index < itemCount; index++) {
			await addToCartButtons.nth(index).click({ force: true })
			await page.waitForTimeout(2000)
		}

		await page.locator('a.cart-contents').click()
		await page.locator('.checkout-button').click()
	})

	await step('Checkout Cart', async () => {
		await page.waitForTimeout(2000)
		const errorMessage = page.locator('#datetimeError')

		if (!(await errorMessage.isVisible())) {
			await page.waitForSelector('#svntnAcuityDayChoices >> .acuityChoice', {
				timeout: 45 * 1000,
			})
			await page.locator('#svntnAcuityDayChoices >> .acuityChoice').first().click()
			await page.waitForSelector('#svntnAcuityTimeChoices >> .acuityChoice')
			await page.locator('#svntnAcuityTimeChoices >> .acuityChoice').first().click()
		}

		const placeOrderButton = page.locator('id=place_order')
		await placeOrderButton.waitFor({ state: 'visible' })
		await placeOrderButton.click()
	})
}

module.exports = {
	TheListImageUploads,
}
