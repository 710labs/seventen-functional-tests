import test, { expect, Locator, Page } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { fictionalAreacodes } from '../utils/data-generator'
import { QAClient } from '../support/qa/client'
import { getUsageLabel, isMedicalUsage, type TestUsageType } from '../utils/usage-types'

export class CreateAccountPage {
	readonly page: Page
	readonly userNameField: Locator
	readonly passwordField: Locator
	readonly usageType: Locator
	readonly zipCode: Locator
	readonly firstName: Locator
	readonly lastName: Locator
	readonly birthMonth: Locator
	readonly birthDay: Locator
	readonly birthYear: Locator
	readonly address: Locator
	readonly medCardExpMonth: Locator
	readonly medCardExpDay: Locator
	readonly medCardExpYear: Locator
	readonly driversLicenseExpMonth: Locator
	readonly driversLicenseExpDay: Locator
	readonly driversLicenseExpYear: Locator
	readonly patientId: Locator
	readonly updateBirthMonth: Locator
	readonly updateBirthDay: Locator
	readonly updateBirthYear: Locator
	readonly driversLicenseUpload: Locator
	readonly driversLicenseNumber: Locator
	readonly medicalCardUpload: Locator
	readonly medCardNumber: Locator
	readonly lostPasswordLink: Locator
	readonly rememberMeCheckBox: Locator
	readonly loginButton: Locator
	readonly createAccountLink: Locator
	readonly defaultAddress: string
	readonly phoneNumber: Locator
	apiUser: any
	qaClient: QAClient

	//svntn_core_pxp_month

	constructor(page: Page, qaClient: QAClient) {
		;(this.page = page),
			(this.qaClient = qaClient),
			(this.userNameField = page.locator('input[name="email"]'))
		this.passwordField = page.locator('input[name="password"]')
		this.usageType = page.locator('input[name="svntn_last_usage_type"]')
		if (process.env.NEXT_VERSION === 'false') {
			this.zipCode = page.locator('input[name="svntn_core_registration_zip"]')
		} else {
			this.zipCode = page.locator('input[name="billing_postcode"]')
		}
		this.firstName = page.locator('input[name="svntn_core_registration_firstname"]')
		this.lastName = page.locator('input[name="svntn_core_registration_lastname"]')
		this.birthMonth = page.locator('select[name="svntn_core_dob_month"]')
		this.birthDay = page.locator('select[name="svntn_core_dob_day"]')
		this.birthYear = page.locator('select[name="svntn_core_dob_year"]')
		this.updateBirthMonth = page.locator('select[name="svntn_core_dob_month"]')
		this.updateBirthDay = page.locator('select[name="svntn_core_dob_day"]')
		this.updateBirthYear = page.locator('select[name="svntn_core_dob_year"]')
		this.address = page.locator('input[name="billing_address_1"]')
		this.medCardExpMonth = page.locator('select[name="svntn_core_mxp_month"]')
		this.medCardExpDay = page.locator('select[name="svntn_core_mxp_day"]')
		this.medCardExpYear = page.locator('select[name="svntn_core_mxp_year"]')
		this.driversLicenseExpMonth = page.locator('select[name="svntn_core_pxp_month"]')
		this.driversLicenseExpDay = page.locator('select[name="svntn_core_pxp_day"]')
		this.driversLicenseExpYear = page.locator('select[name="svntn_core_pxp_year"]')
		this.patientId = page.locator('input[name="_svntn_fl_patient_id"]')
		this.driversLicenseUpload = page.locator('#wccf_user_field_drivers_license')
		this.driversLicenseNumber = page.locator('input[name="svntn_pno"]')
		this.medicalCardUpload = page.locator('#wccf_user_field_medical_card')
		this.medCardNumber = page.locator('input[name="svntn_mno"]')
		this.apiUser = null
		this.defaultAddress = '123 Main Street'
		this.phoneNumber = page.locator('input[name="billing_phone"]')
	}

	private assertSupportedUsageForState(usage: TestUsageType, state: string) {
		if (!['CA', 'CO', 'FL', 'NJ'].includes(state)) {
			throw new Error(`Unsupported registration state "${state}" for usage "${usage}".`)
		}

		if (state === 'FL' && !isMedicalUsage(usage)) {
			throw new Error('Florida registration only supports medical usage in this helper.')
		}
	}

	private async selectRegistrationUsageType(usage: TestUsageType) {
		await test.step(`Select ${getUsageLabel(usage)} Usage Type`, async () => {
			await this.page
				.locator(`text=${getUsageLabel(usage)} >> input[name="svntn_last_usage_type"]`)
				.click()
		})
	}

	private async uploadMedicalCard(fileName: string = 'CA-DL.jpg') {
		await test.step('Upload Medical Card', async () => {
			const medicalCardInput = this.page.locator('input[name="svntn_core_medical_doc"]')
			await medicalCardInput.waitFor({ state: 'attached' })
			await medicalCardInput.setInputFiles(fileName)
			await this.page.waitForTimeout(5000)
		})
	}

	private async enterMedicalCardExpiration() {
		await test.step('Enter Med Card Exp', async () => {
			await this.medCardExpMonth.selectOption('12')
			await this.medCardExpDay.selectOption('16')
			await this.medCardExpYear.selectOption(`${new Date().getFullYear() + 1}`)
		})
	}

	async createApi(usage: TestUsageType, userType: string): Promise<any> {
		await test.step('Create Client via API', async () => {
			this.apiUser = await this.qaClient.createUser({
				user_role: 'customer',
				user_usage: usage,
				user_vintage: userType,
			})
		})

		return this.apiUser
	}

	async create(
		firstName: string,
		lastName: string,
		username: string,
		password: string,
		zipcode: string,
		usage: TestUsageType,
		logout: boolean = false,
		address: string = '3377 S La Cienega Blvd, Los Angeles, CA 90210',
		state: string = 'CA',
		medCardNumber: string = '1234567890',
	) {
		this.assertSupportedUsageForState(usage, state)

		await test.step('Verify Layout', async () => {})

		await test.step('Click Register Link', async () => {
			await this.page.click('text=create an account')
			await expect(this.page).toHaveURL('/register/')
		})

		await test.step('Enter Username', async () => {
			await this.userNameField.click()
			await this.userNameField.fill(username)
		})

		await test.step('Enter Passowrd', async () => {
			await this.passwordField.click()
			await this.passwordField.fill(password)
		})

		await test.step('Enter First Name', async () => {
			await this.firstName.click()
			await this.firstName.fill(firstName)
		})

		await test.step('Enter Last Name', async () => {
			await this.lastName.click()
			await this.lastName.fill(lastName)
		})

		await test.step('Enter Birthdate', async () => {
			await this.birthMonth.selectOption('12')
			await this.birthDay.selectOption('16')
			await this.birthYear.selectOption('1988')
		})

		if (process.env.NEXT_VERSION === 'false') {
			await test.step('Enter Zip Code', async () => {
				await this.zipCode.click()
				await this.zipCode.fill(zipcode)
			})
		} else {
			await test.step('Enter Billing Address', async () => {
				await this.address.click()
				await this.address.fill(address)
				await this.page.waitForTimeout(1000)
				await this.page.keyboard.press('ArrowDown')
				await this.page.keyboard.press('Enter')
			})
		}

		if (process.env.NEXT_VERSION === 'true' && state === 'FL') {
			await test.step('Enter PatientId', async () => {
				const patientIdCount = await this.patientId.count()
				if (patientIdCount === 0) {
					return
				}

				try {
					await this.patientId.waitFor({ state: 'visible', timeout: 5000 })
				} catch {
					return
				}

				await this.patientId.click()
				await this.patientId.fill('1234abcd')
			})
		}

		await test.step('Enter Phone Number', async () => {
			await this.phoneNumber.click()
			await this.phoneNumber.fill(faker.phone.phoneNumber('555-###-####'))
		})

		await test.step('Submit New Customer Form', async () => {
			await this.page.waitForTimeout(2000)
			await this.page.click('button:has-text("Next")')
			await this.page.waitForTimeout(1000)
		})

		await test.step('Upload Drivers License', async () => {
			const dlUploadButton = await this.page.waitForSelector(
				'input[name="svntn_core_personal_doc"]',
			)
			const [driversLicenseChooser] = await Promise.all([
				this.page.waitForEvent('filechooser'),
				dlUploadButton.click(),
			])
			await this.page.waitForTimeout(5000)
			await driversLicenseChooser.setFiles('CA-DL.jpg')
			await this.page.waitForTimeout(5000)
			await driversLicenseChooser.page()

			await test.step('Enter Drivers License Exp', async () => {
				await this.driversLicenseExpMonth.selectOption('12')
				await this.driversLicenseExpDay.selectOption('16')
				await this.driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
			})
		})

		if (state === 'FL') {
			await this.uploadMedicalCard('Medical-Card.png')
			await test.step('Enter Med Card Exp', async () => {
				await expect(this.medCardExpMonth).toBeVisible()
				await expect(this.medCardExpMonth).toBeEnabled()

				await expect(this.medCardExpDay).toBeVisible()
				await expect(this.medCardExpDay).toBeEnabled()

				await expect(this.medCardExpYear).toBeVisible()
				await expect(this.medCardExpYear).toBeEnabled()

				await this.page.waitForTimeout(5000)

				await this.medCardExpMonth.selectOption('12')
				await this.medCardExpDay.selectOption('16')
				await this.medCardExpYear.selectOption(`${new Date().getFullYear() + 1}`)
			})
		} else {
			await this.selectRegistrationUsageType(usage)

			if (isMedicalUsage(usage)) {
				await this.uploadMedicalCard()
				await this.enterMedicalCardExpiration()

				if (state === 'NJ') {
					await test.step('Enter Med Card Number', async () => {
						await this.medCardNumber.fill(medCardNumber)
					})
				}
			}
		}

		if (state === 'FL') {
			await test.step('Complete Usage Type Form', async () => {
				await (await this.page.$('text=Register')).click()
				await this.page.waitForTimeout(5000)
				await expect(this.page).toHaveURL('/#deliver')
			})
		} else {
			await test.step('Complete Usage Type Form', async () => {
				await (await this.page.$('text=Register')).click()
				await this.page.waitForTimeout(5000)
				await expect(this.page.url()).toMatch(/\/#pickup-deliver|\/#pickup$/)
			})
		}

		if (logout) {
			await this.page.goto('/my-account')
			await this.page.locator('text=Logout').click()
		}
	}

	async createMichiganCustomer(
		firstName: string,
		lastName: string,
		username: string,
		password: string,
		birthDay: number,
		birthMonth: number,
		birthYear: number,
		phone: string,
		type: TestUsageType,
		address: string,
		medCardNumber: string,
		driversLicenseNumber: string,
	) {
		await test.step('Click Register Link', async () => {
			await this.page.click('text=create an account')
			await expect(this.page).toHaveURL('/register/')
		})

		await test.step('Enter First Name', async () => {
			await this.firstName.click()
			await this.firstName.fill(firstName)
		})

		await test.step('Enter Last Name', async () => {
			await this.lastName.click()
			await this.lastName.fill(lastName)
		})

		await test.step('Enter Email', async () => {
			await this.userNameField.click()
			await this.userNameField.fill(username)
		})

		await test.step('Enter Passowrd', async () => {
			await this.passwordField.click()
			await this.passwordField.fill(password)
		})

		await test.step('Enter Birthdate', async () => {
			await this.birthMonth.selectOption(`${birthMonth}`)
			await this.birthDay.selectOption(`${birthDay}`)
			await this.birthYear.selectOption(`${birthYear}`)
		})

		await test.step('Enter Billing Address', async () => {
			await this.address.click()
			await this.address.fill(address)
			await this.page.waitForTimeout(1000)
			await this.page.keyboard.press('ArrowDown')
			await this.page.keyboard.press('Enter')
		})

		await test.step('Enter Phone Number', async () => {
			await this.phoneNumber.click()
			await this.phoneNumber.fill(`${phone}`)
		})

		await test.step('Click Next Link', async () => {
			await this.page.getByRole('button', { name: 'Next' }).click()
			await this.page.waitForSelector('#eligibilityContext')
		})

		if (isMedicalUsage(type)) {
			await test.step('Select Medical Usage Type', async () => {
				await this.page.waitForTimeout(5000)
				await this.page.getByLabel('Medical', { exact: true }).check()
				await this.page.waitForTimeout(5000)
			})

			await test.step('Upload Drivers License', async () => {
				await this.page.getByLabel("ID Upload (driver's license or passport) *").click()
				await this.page
					.getByLabel("ID Upload (driver's license or passport) *")
					.setInputFiles('CA-DL.jpg')
			})

			await test.step('Enter DL Exp', async () => {
				await this.driversLicenseExpMonth.selectOption(`${birthMonth}`)
				await this.driversLicenseExpDay.selectOption(`${birthDay}`)
				await this.driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
				//
			})

			await test.step('Enter DLNumber', async () => {
				await this.driversLicenseNumber.fill(`${driversLicenseNumber}`)
			})

			await test.step('Upload Medical Card', async () => {
				await this.page.getByLabel('Medical Card Upload *').click()
				await this.page.getByLabel('Medical Card Upload *').setInputFiles('Medical-Card.png')
			})

			await test.step('Enter Med Card Exp', async () => {
				await this.medCardExpMonth.selectOption('12')
				await this.medCardExpDay.selectOption('16')
				await this.medCardExpYear.selectOption(`${new Date().getFullYear() + 1}`)
			})
			await test.step('Enter Med Card Number', async () => {
				await this.medCardNumber.fill(medCardNumber)
			})
		}

		if (!isMedicalUsage(type)) {
			await test.step('Select Recreational Usage Type', async () => {
				await this.page.locator('text=Recreational >> input[name="svntn_last_usage_type"]').click()
			})
			await test.step('Upload Drivers License', async () => {
				const dlUploadButton = await this.page.waitForSelector(
					'input[name="svntn_core_personal_doc"]',
				)
				const [driversLicenseChooser] = await Promise.all([
					this.page.waitForEvent('filechooser'),
					dlUploadButton.click(),
				])
				await this.page.waitForTimeout(5000)
				await driversLicenseChooser.setFiles('CA-DL.jpg')
				await this.page.waitForTimeout(5000)
				await driversLicenseChooser.page()
			})

			await test.step('Enter DL Exp', async () => {
				await this.driversLicenseExpMonth.selectOption('12')
				await this.driversLicenseExpDay.selectOption('16')
				await this.driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
			})

			await test.step('Enter DLNumber', async () => {
				await this.page.getByLabel('ID Number *').click()
				await this.page.getByLabel('ID Number *').fill(driversLicenseNumber)
			})
		}

		await test.step('Complete Usage Type Form', async () => {
			await await this.page.getByRole('button', { name: 'Register' }).click()
			await this.page.waitForTimeout(5000)
			await expect(this.page.url()).toMatch(/\/#pickup-deliver|\/#pickup$/)
		})
	}

	async createCaliforniaCustomer(
		firstName: string,
		lastName: string,
		username: string,
		password: string,
		birthDay: number,
		birthMonth: number,
		birthYear: number,
		phone: string,
		type: TestUsageType,
		address: string,
		medCardNumber: string,
		driversLicenseNumber: string,
	) {
		await test.step('Click Register Link', async () => {
			await this.page.click('text=create an account')
			await expect(this.page).toHaveURL('/register/')
		})

		await test.step('Enter First Name', async () => {
			await this.firstName.click()
			await this.firstName.fill(firstName)
		})

		await test.step('Enter Last Name', async () => {
			await this.lastName.click()
			await this.lastName.fill(lastName)
		})

		await test.step('Enter Email', async () => {
			await this.userNameField.click()
			await this.userNameField.fill(username)
		})

		await test.step('Enter Passowrd', async () => {
			await this.passwordField.click()
			await this.passwordField.fill(password)
		})

		await test.step('Enter Birthdate', async () => {
			await this.birthMonth.selectOption(`${birthMonth}`)
			await this.birthDay.selectOption(`${birthDay}`)
			await this.birthYear.selectOption(`${birthYear}`)
		})

		await test.step('Enter Billing Address', async () => {
			await this.address.click()
			await this.address.fill(address)
			await this.page.waitForTimeout(1000)
			await this.page.keyboard.press('ArrowDown')
			await this.page.keyboard.press('Enter')
		})

		await test.step('Enter Phone Number', async () => {
			await this.phoneNumber.click()
			await this.phoneNumber.fill(`${phone}`)
		})

		await test.step('Click Next Link', async () => {
			await this.page.getByRole('button', { name: 'Next' }).click()
			await this.page.waitForSelector('#eligibilityContext')
		})

		if (isMedicalUsage(type)) {
			await test.step('Select Medical Usage Type', async () => {
				await this.page.waitForTimeout(5000)
				await this.page.getByLabel('Medical', { exact: true }).check()
				await this.page.waitForTimeout(5000)
			})

			await test.step('Upload Drivers License', async () => {
				await this.page.getByLabel("ID Upload (driver's license or passport) *").click()
				await this.page
					.getByLabel("ID Upload (driver's license or passport) *")
					.setInputFiles('CA-DL.jpg')
			})

			await test.step('Enter Drivers License Exp', async () => {
				await this.driversLicenseExpMonth.selectOption('12')
				await this.driversLicenseExpDay.selectOption('16')
				await this.driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
			})

			await test.step('Upload Medical Card', async () => {
				await this.page.getByLabel('Medical Card Upload *').click()
				await this.page.getByLabel('Medical Card Upload *').setInputFiles('Medical-Card.png')
			})

			await test.step('Enter Med Card Exp', async () => {
				await this.medCardExpMonth.selectOption('12')
				await this.medCardExpDay.selectOption('16')
				await this.medCardExpYear.selectOption(`${new Date().getFullYear() + 1}`)
			})
		}

		if (!isMedicalUsage(type)) {
			await test.step('Select Recreational Usage Type', async () => {
				await this.page.locator('text=Recreational >> input[name="svntn_last_usage_type"]').click()
			})
			await test.step('Upload Drivers License', async () => {
				const dlUploadButton = await this.page.waitForSelector(
					'input[name="svntn_core_personal_doc"]',
				)
				const [driversLicenseChooser] = await Promise.all([
					this.page.waitForEvent('filechooser'),
					dlUploadButton.click(),
				])
				await this.page.waitForTimeout(5000)
				await driversLicenseChooser.setFiles('CA-DL.jpg')
				await this.page.waitForTimeout(5000)
				await driversLicenseChooser.page()

				await test.step('Enter Drivers License Exp', async () => {
					await this.driversLicenseExpMonth.selectOption('12')
					await this.driversLicenseExpDay.selectOption('16')
					await this.driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
				})
			})
		}

		await test.step('Complete Usage Type Form', async () => {
			await await this.page.getByRole('button', { name: 'Register' }).click()
			await this.page.waitForTimeout(5000)
			await expect(this.page.url()).toMatch(/\/#pickup-deliver|\/#pickup$/)
		})

		test.info().annotations.push({
			type: 'Name',
			description: `${firstName} ${lastName}`,
		})

		test.info().annotations.push({
			type: 'Email',
			description: `${username}`,
		})

		test.info().annotations.push({
			type: 'Phone',
			description: `${phone}`,
		})
		test.info().annotations.push({
			type: 'Address',
			description: `${address}`,
		})
		test.info().annotations.push({
			type: 'Customer Type',
			description: `${getUsageLabel(type)}`,
		})

		test.info().annotations.push({
			type: 'DOB',
			description: `${birthMonth}/${birthDay}/${birthYear}`,
		})
		test.info().annotations.push({
			type: 'Password',
			description: `${password}`,
		})
	}

	async createColoradoCustomer(
		username: string,
		password: string,
		zipcode: string,
		type: TestUsageType,
		logout: boolean = false,
		address: string = '933 Alpine Ave, Boulder, CO, 80304',
		state: string = 'CO',
	) {
		await test.step('Verify Layout', async () => {})

		await test.step('Click Register Link', async () => {
			await this.page.click('text=create an account')
			await expect(this.page).toHaveURL('/register/')
		})

		await test.step('Enter Username', async () => {
			await this.userNameField.click()
			await this.userNameField.fill(username)
		})

		await test.step('Enter Passowrd', async () => {
			await this.passwordField.click()
			await this.passwordField.fill(password)
		})

		await test.step('Enter First Name', async () => {
			await this.firstName.click()
			await this.firstName.fill(username)
		})

		await test.step('Enter Last Name', async () => {
			await this.lastName.click()
			await this.lastName.fill(username)
		})

		await test.step('Enter Birthdate', async () => {
			await this.birthMonth.selectOption('12')
			await this.birthDay.selectOption('16')
			await this.birthYear.selectOption('1988')
		})

		if (process.env.NEXT_VERSION === 'false') {
			await test.step('Enter Zip Code', async () => {
				await this.zipCode.click()
				await this.zipCode.fill(zipcode)
			})
		} else {
			await test.step('Enter Billing Address', async () => {
				await this.address.click()
				await this.address.fill(address)
				await this.page.waitForTimeout(1000)
				await this.page.keyboard.press('ArrowDown')
				await this.page.keyboard.press('Enter')
			})
		}

		await test.step('Enter Phone Number', async () => {
			await this.phoneNumber.click()
			await this.phoneNumber.fill(faker.phone.phoneNumber('555-###-####'))
		})

		await test.step('Submit New Customer Form', async () => {
			await this.page.waitForTimeout(2000)
			await this.page.click('button:has-text("Next")')
			await this.page.waitForTimeout(1000)
		})

		await test.step('Upload Drivers License', async () => {
			const dlUploadButton = await this.page.waitForSelector(
				'input[name="svntn_core_personal_doc"]',
			)
			const [driversLicenseChooser] = await Promise.all([
				this.page.waitForEvent('filechooser'),
				dlUploadButton.click(),
			])
			await this.page.waitForTimeout(5000)
			await driversLicenseChooser.setFiles('CA-DL.jpg')
			await this.page.waitForTimeout(5000)
			await driversLicenseChooser.page()

			await test.step('Enter Drivers License Exp', async () => {
				await this.driversLicenseExpMonth.selectOption('12')
				await this.driversLicenseExpDay.selectOption('16')
				await this.driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
			})
		})

		await this.selectRegistrationUsageType(type)

		if (isMedicalUsage(type) && state === 'CO') {
			await this.uploadMedicalCard()
			await this.enterMedicalCardExpiration()
		}

		await test.step('Complete Usage Type Form', async () => {
			await (await this.page.$('text=Register')).click()
			await this.page.waitForTimeout(5000)
			await expect(this.page.url()).toMatch(/\/#pickup-deliver|\/#pickup$/)
		})

		if (logout) {
			await this.page.goto('/my-account')
			await this.page.locator('text=Logout').click()
		}
	}
}
