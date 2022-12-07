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
	readonly patientId: Locator
	readonly updateBirthMonth: Locator
	readonly updateBirthDay: Locator
	readonly updateBirthYear: Locator
	readonly driversLicenseUpload: Locator
	readonly medicalCardUpload: Locator
	readonly lostPasswordLink: Locator
	readonly rememberMeCheckBox: Locator
	readonly loginButton: Locator
	readonly createAccountLink: Locator
	readonly defaultAddress: string
	readonly phoneNumber: Locator
	apiUser: any
	apiContext: APIRequestContext

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
		this.patientId = page.locator('input[name="_svntn_fl_patient_id"]')
		this.driversLicenseUpload = page.locator('#wccf_user_field_drivers_license')
		this.medicalCardUpload = page.locator('#wccf_user_field_medical_card')
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
			console.log(this.apiUser)
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
			if (process.env.BASE_URL === 'https://thelist.theflowery.co/') {
				await this.page.locator('select[name="svntn_core_dob_month_sbmt"]').selectOption('12')
				await this.page.locator('select[name="svntn_core_dob_day_sbmt"]').selectOption('16')
				await this.page.locator('select[name="svntn_core_dob_year_sbmt"]').selectOption('1988')
			} else {
				await this.birthMonth.selectOption('12')
				await this.birthDay.selectOption('16')
				await this.birthYear.selectOption('1988')
			}
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

		if (
			process.env.NEXT_VERSION === 'true' &&
			state === 'FL' 
		) {
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
			await driversLicenseChooser.setFiles('CA-DL.jpg')
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
				await medicalCardChooser.setFiles('Medical-Card.png')
				await medicalCardChooser.page()
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
			if (state === 'FL') {
				await test.step('Enter Med Card Exp', async () => {
					await this.medCardExpMonth.selectOption('12')
					await this.medCardExpDay.selectOption('16')
					await this.medCardExpYear.selectOption('2023')
				})
			}
		}
		if (state === 'FL' && process.env.BASE_URL === 'https://thelist.theflowery.co/') {
			await test.step('Enter PatientId', async () => {
				await this.page.locator('input[name="svntn_fl_patient_id"]').click()
				await this.page.locator('input[name="svntn_fl_patient_id"]').fill('1234abcd')
			})
		}
		await test.step('Complete Usage Type Form', async () => {
			await (await this.page.$('text=Register')).click()
			await expect(this.page).toHaveURL('/')
		})

		console.log({
			username,
			password,
			type,
			zipcode,
		})

		if (logout) {
			await this.page.goto('/my-account')
			await this.page.locator('text=Logout').click()
		}
	}
}
