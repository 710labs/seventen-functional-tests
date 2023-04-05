import test, { APIRequestContext, expect, Locator, Page, request } from '@playwright/test'

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
	apiContext: APIRequestContext

	//svntn_core_pxp_month

	constructor(page: Page, apiContext: APIRequestContext) {
		;(this.page = page),
			(this.apiContext = apiContext),
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
	async createApi(usage: string, userType: string): Promise<any> {
		await test.step('Create Client via API', async () => {
			const createUserResponse = await this.apiContext.get(
				`users/create/?userRole=customer&userUsage=${usage}&userVintage=${userType}`,
			)
			this.apiUser = await createUserResponse.json()
		})

		return this.apiUser.user
	}

	async create(
		username: string,
		password: string,
		zipcode: string,
		type: number,
		logout: boolean = false,
		address: string = '123 Front Street',
		state: string = 'CA',
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

		if (process.env.NEXT_VERSION === 'true' && state === 'FL') {
			await test.step('Enter PatientId', async () => {
				await this.patientId.click()
				await this.patientId.fill('1234abcd')
			})
		}

		await test.step('Enter Phone Number', async () => {
			await this.phoneNumber.click()
			await this.phoneNumber.fill('4204201111')
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
			await driversLicenseChooser.setFiles('Medical-Card.png')
			await this.page.waitForTimeout(5000)
			await driversLicenseChooser.page()
		})

		if (type == 1 && state === 'CA') {
			await test.step('Select Medical Usage Type', async () => {
				await this.page.locator('text=Medical >> input[name="svntn_last_usage_type"]').click()
			})
			await test.step('Upload Medical Card', async () => {
				const medicalCardButton = await this.page.waitForSelector(
					'input[name="svntn_core_medical_doc"]',
				)
				const [medicalCardChooser] = await Promise.all([
					this.page.waitForEvent('filechooser'),
					medicalCardButton.click(),
				])
				await medicalCardChooser.setFiles('CA-DL.jpg')
				await medicalCardChooser.page()
				await this.page.waitForTimeout(5000)
			})

			await test.step('Enter Med Card Exp', async () => {
				await this.medCardExpMonth.selectOption('12')
				await this.medCardExpDay.selectOption('16')
				await this.medCardExpYear.selectOption('2023')
			})
		}
		if (state === 'FL') {
			await test.step('Upload Medical Card', async () => {
				const medicalCardButton = await this.page.waitForSelector(
					'input[name="svntn_core_medical_doc"]',
				)
				const [medicalCardChooser] = await Promise.all([
					this.page.waitForEvent('filechooser'),
					medicalCardButton.click(),
				])
				await medicalCardChooser.setFiles('Medical-Card.png')
				await medicalCardChooser.page()
			})
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
				await this.medCardExpYear.selectOption('2023')
			})
		}
		await test.step('Complete Usage Type Form', async () => {
			await (await this.page.$('text=Register')).click()
			await this.page.waitForTimeout(5000)
			await expect(this.page).toHaveURL('/')
		})

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
		phone: number,
		type: string,
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

		if (type === 'medical') {
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
				await this.driversLicenseExpYear.selectOption('2024')
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
				await this.medCardExpYear.selectOption('2023')
			})
			await test.step('Enter Med Card Number', async () => {
				await this.medCardNumber.fill(medCardNumber)
			})
		}

		if (type === 'recreational') {
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
				await this.driversLicenseExpYear.selectOption('2023')
			})

			await test.step('Enter DLNumber', async () => {
				await this.page.getByLabel('ID Number *').click()
				await this.page.getByLabel('ID Number *').fill(driversLicenseNumber)
			})
		}

		await test.step('Complete Usage Type Form', async () => {
			await await this.page.getByRole('button', { name: 'Register' }).click()
			await this.page.waitForTimeout(5000)
			await expect(this.page).toHaveURL('/')
		})
	}
}
