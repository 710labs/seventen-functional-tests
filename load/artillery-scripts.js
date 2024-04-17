const faker = require('@faker-js/faker').faker

async function caWorkflow(page, vuContext, events, test) {
	const { step } = test
	const userid = vuContext.vars.userid
	const recordid = vuContext.vars.recordid
	const userFirstName = faker.name.firstName()
	const userLastName = faker.name.lastName()
	const userEmail = `${userFirstName.toLowerCase()}.${userLastName.toLowerCase()}@mail7.io`
	const userAddress = '3377 S La Cienega Blvd, Los Angeles, CA 90016'

	await step('Pass Age Gate', async () => {
		await step('Load 710 Labs ', async () => {
			await page.goto('https://thelist-stage.710labs.com')
		})

		await step('Click Age Gate Acceptance', async () => {
			await page.getByRole('button', { name: "I'm over 21 or a qualified" }).click()
		})
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
				await phoneNumber.fill(faker.phone.phoneNumber(`555-###-####`))
			})

			await step('Submit New Customer Form', async () => {
				await page.waitForTimeout(2000)
				await page.click('button:has-text("Next")')
				await page.waitForTimeout(1000)
			})
		})

		// await step('Enter Validation Info', async () => {
		// 	await step('Submit Drivers License', async () => {
		// 		await step('Upload DL File', async () => {
		// 			const dlUploadButton = await page.waitForSelector('input[name="svntn_core_personal_doc"]')
		// 			const [driversLicenseChooser] = await Promise.all([
		// 				page.waitForEvent('filechooser'),
		// 				dlUploadButton.click(),
		// 			])
		// 			await page.waitForTimeout(5000)
		// 			await driversLicenseChooser.setFiles('CA-DL.jpg')
		// 			await page.waitForTimeout(5000)
		// 		})
		// 		await step('Enter DL Exp', async () => {
		// 			const driversLicenseExpMonth = await page.waitForSelector(
		// 				'select[name="svntn_core_pxp_month"]',
		// 			)
		// 			const driversLicenseExpDay = await page.waitForSelector(
		// 				'select[name="svntn_core_pxp_day"]',
		// 			)
		// 			const driversLicenseExpYear = await page.waitForSelector(
		// 				'select[name="svntn_core_pxp_year"]',
		// 			)

		// 			await driversLicenseExpMonth.selectOption('12')
		// 			await driversLicenseExpDay.selectOption('16')
		// 			await driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
		// 		})
		// 	})
		// 	await step('Submit Validation Info', async () => {
		// 		await page.getByRole('button', { name: 'Register' }).click()
		// 		await page.waitForTimeout(5000)
		// 	})
		// })
	})

	await step('Create Cart', async () => {
		await step('Enter Account Info', async () => {})

		await step('Enter Validation Info', async () => {})
	})

	await step('Checkout Cart', async () => {
		await step('Enter Delivery Info', async () => {})

		await step('Complete Order', async () => {})
	})
}

async function coWorkflow(page) {}

async function miWorkflow(page) {}

module.exports = { caWorkflow, coWorkflow, miWorkflow }
