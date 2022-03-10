import test, { expect, Locator, Page, request } from '@playwright/test'

export class CreateAccountPage {
	readonly page: Page
	readonly userNameField: Locator
	readonly passwordField: Locator
	readonly usageType: Locator
	readonly zipCode: Locator
	readonly birthMonth: Locator
	readonly birthDay: Locator
	readonly birthYear: Locator
	readonly updateBirthMonth: Locator
	readonly updateBirthDay: Locator
	readonly updateBirthYear: Locator
	readonly driversLicenseUpload: Locator
	readonly medicalCardUpload: Locator
	readonly lostPasswordLink: Locator
	readonly rememberMeCheckBox: Locator
	readonly loginButton: Locator
	readonly createAccountLink: Locator

	constructor(page: Page) {
		this.page = page
		this.userNameField = page.locator('input[name="email"]')
		this.passwordField = page.locator('input[name="password"]')
		this.usageType = page.locator('input[name="svntn_last_usage_type"]')
		this.zipCode = page.locator('input[name="svntn_core_registration_zip"]')
		this.birthMonth = page.locator('select[name="svntn_core_dob_month_sbmt"]')
		this.birthDay = page.locator('select[name="svntn_core_dob_day_sbmt"]')
		this.birthYear = page.locator('select[name="svntn_core_dob_year_sbmt"]')
		this.updateBirthMonth = page.locator('select[name="svntn_core_dob_month"]')
		this.updateBirthDay = page.locator('select[name="svntn_core_dob_day"]')
		this.updateBirthYear = page.locator('select[name="svntn_core_dob_year"]')

		this.driversLicenseUpload = page.locator('#wccf_user_field_drivers_license')
		this.medicalCardUpload = page.locator('#wccf_user_field_medical_card')
	}
	async createApi(usage: string, userType: string): Promise<any> {
		await test.step('Create Client via API', async () => {
			const apiContext = await request.newContext({
				baseURL: 'https://dev.710labs.com',
				extraHTTPHeaders: {
					'x-api-key': `${process.env.API_KEY}`,
				},
			})
			const createUserResponse = await apiContext.get(
				`/wp-content/plugins/seventen-testing-api/api/users/create/?userRole=customer&userUsage=${usage}&userVintage=${userType}`,
			)
			const createUserResponseBody: any = await createUserResponse.json()
			console.log(createUserResponseBody.user)
			const user = createUserResponseBody.user

			return user
		})
	}

	async create(
		username: string,
		password: string,
		zipcode: string,
		type: number,
		logout: boolean = false,
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

		// await test.step('Select Usage Type', async () => {
		//   await this.page
		//     .locator(`input[name="svntn_last_usage_type"] >> nth=${type}`)
		//     .check();
		// });

		await test.step('Enter Birthdate', async () => {
			await this.birthMonth.selectOption('12')
			await this.birthDay.selectOption('16')
			await this.birthYear.selectOption('1988')
		})

		await test.step('Enter Zip Code', async () => {
			await this.zipCode.click()
			await this.zipCode.fill(zipcode)
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

		if (type == 1) {
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
