import test, { expect, Locator, Page } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { fictionalAreacodes } from '../utils/data-generator'
import { QAClient } from '../support/qa/client'
import { getUsageLabel, isMedicalUsage, type TestUsageType } from '../utils/usage-types'

type RegistrationFieldSnapshot = {
	exists: boolean
	value: string
}

type RegistrationSubmitSnapshot = {
	url: string
	address: RegistrationFieldSnapshot
	billingState: RegistrationFieldSnapshot
	billingZip: RegistrationFieldSnapshot
	bodyPreview: string
}

const personalDocInputSelector = 'input[name="svntn_core_personal_doc"]'
const personalDocSuccessSelector = [
	'div.eligibilityInput:has(input#svntn_core_personal_doc) span.unsealLabel.unsealSuccess.wcse-reactive--plabel',
	'div.eligibilityInput:has(input[name="svntn_core_personal_doc"]) span.unsealLabel.unsealSuccess',
].join(', ')

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

	private async clearPersonalDocumentInput(driversLicenseInput: Locator) {
		await driversLicenseInput.setInputFiles([])
		await this.page.evaluate(selector => {
			const input = document.querySelector(selector)
			if (!(input instanceof HTMLInputElement)) {
				return
			}

			input.dispatchEvent(new Event('input', { bubbles: true }))
			input.dispatchEvent(new Event('change', { bubbles: true }))
		}, personalDocInputSelector)
	}

	private async selectPersonalDocumentWithFileChooser(
		driversLicenseInput: Locator,
		fileName: string,
	) {
		const [driversLicenseChooser] = await Promise.all([
			this.page.waitForEvent('filechooser'),
			driversLicenseInput.click(),
		])

		// The upload widget initializes asynchronously after the chooser opens.
		// Matching the older e2e cadence avoids selecting the file before its
		// reactive upload handlers are ready.
		await this.page.waitForTimeout(5000)
		await driversLicenseChooser.setFiles(fileName)
		await this.page.waitForFunction(
			({ selector, filename }) => {
				const input = document.querySelector(selector)

				return (
					input instanceof HTMLInputElement &&
					Array.from(input.files || []).some(file => file.name === filename)
				)
			},
			{ selector: personalDocInputSelector, filename: fileName },
		)
	}

	private async isPersonalDocumentAccepted(uploadSuccess: Locator) {
		const successVisible = await uploadSuccess.isVisible().catch(() => false)
		const expirationEnabled =
			(await this.driversLicenseExpMonth.isEnabled().catch(() => false)) &&
			(await this.driversLicenseExpDay.isEnabled().catch(() => false)) &&
			(await this.driversLicenseExpYear.isEnabled().catch(() => false))

		return successVisible || expirationEnabled
	}

	private async waitForPersonalDocumentAccepted(uploadSuccess: Locator, timeout = 20000) {
		const deadline = Date.now() + timeout

		while (Date.now() < deadline) {
			if (await this.isPersonalDocumentAccepted(uploadSuccess)) {
				return true
			}

			await this.page.waitForTimeout(500)
		}

		return false
	}

	private async uploadPersonalDocument(fileName: string = 'CA-DL.jpg') {
		await test.step('Upload Drivers License', async () => {
			const driversLicenseInput = this.page.locator(personalDocInputSelector).first()
			const uploadSuccess = this.page.locator(personalDocSuccessSelector).first()

			await driversLicenseInput.waitFor({ state: 'attached' })
			await expect(driversLicenseInput).toBeEnabled()

			let lastError: unknown = null

			for (let attempt = 1; attempt <= 2; attempt += 1) {
				if (attempt > 1) {
					await this.clearPersonalDocumentInput(driversLicenseInput)
					await this.page.waitForTimeout(1000)
				}

				try {
					await this.selectPersonalDocumentWithFileChooser(driversLicenseInput, fileName)

					if (await this.waitForPersonalDocumentAccepted(uploadSuccess)) {
						return
					}
				} catch (error) {
					lastError = error
				}
			}

			{
				const uploadedFiles = await driversLicenseInput.evaluate(input =>
					input instanceof HTMLInputElement
						? Array.from(input.files || []).map(file => file.name)
						: [],
				)
				const eligibilityError = await this.page
					.locator('p.eligibilityError, .eligibilityError')
					.allTextContents()
					.catch(() => [])
				const successVisible = await uploadSuccess.isVisible().catch(() => false)
				const expMonthEnabled = await this.driversLicenseExpMonth.isEnabled().catch(() => false)
				const expDayEnabled = await this.driversLicenseExpDay.isEnabled().catch(() => false)
				const expYearEnabled = await this.driversLicenseExpYear.isEnabled().catch(() => false)
				const bodyPreview = ((await this.page.locator('body').textContent().catch(() => '')) || '')
					.replace(/\s+/g, ' ')
					.trim()
					.slice(0, 1000)

				throw new Error(
					[
						'Drivers license file was selected, but the storefront did not mark the ID upload as accepted.',
						`Expected file: ${fileName}`,
						`Selected file(s): ${uploadedFiles.join(', ') || 'none'}`,
						`Eligibility error text: ${eligibilityError.join(' | ') || 'none'}`,
						`Upload success badge visible: ${successVisible}`,
						`Expiration fields enabled: month=${expMonthEnabled}, day=${expDayEnabled}, year=${expYearEnabled}`,
						`Body preview: ${bodyPreview}`,
						`${lastError || 'Timed out waiting for upload acceptance'}`,
					].join('\n'),
				)
			}
		})
	}

	private async enterMedicalCardExpiration() {
		await test.step('Enter Med Card Exp', async () => {
			await this.medCardExpMonth.selectOption('12')
			await this.medCardExpDay.selectOption('16')
			await this.medCardExpYear.selectOption(`${new Date().getFullYear() + 1}`)
		})
	}

	private normalizeZip(zipcode?: string) {
		return (zipcode || '').replace(/\D/g, '').slice(0, 5)
	}

	private inferZipFromAddress(address: string) {
		return this.normalizeZip(address.match(/\b\d{5}(?:-\d{4})?\b/)?.[0])
	}

	private inferStateFromAddress(address: string) {
		return (address.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/)?.[1] || '').toUpperCase()
	}

	private async getBodyPreview() {
		const bodyText = await this.page
			.locator('body')
			.innerText({ timeout: 1000 })
			.catch(() => '')

		return bodyText.replace(/\s+/g, ' ').trim().slice(0, 500)
	}

	private async inputValue(selector: string) {
		const locator = this.page.locator(selector).first()

		if ((await locator.count()) === 0) {
			return ''
		}

		return locator.inputValue({ timeout: 1000 }).catch(() => '')
	}

	private async inputSnapshot(selector: string): Promise<RegistrationFieldSnapshot> {
		const locator = this.page.locator(selector).first()
		const exists = (await locator.count()) > 0

		return {
			exists,
			value: exists ? await locator.inputValue({ timeout: 1000 }).catch(() => '') : '',
		}
	}

	private async locatorInputSnapshot(locator: Locator): Promise<RegistrationFieldSnapshot> {
		const exists = (await locator.count()) > 0

		return {
			exists,
			value: exists ? await locator.first().inputValue({ timeout: 1000 }).catch(() => '') : '',
		}
	}

	private async registrationSubmitSnapshot(): Promise<RegistrationSubmitSnapshot> {
		return {
			url: this.page.url(),
			address: await this.locatorInputSnapshot(this.address),
			billingState: await this.inputSnapshot(
				'select[name="billing_state"], input[name="billing_state"], #billing_state',
			),
			billingZip: await this.inputSnapshot('input[name="billing_postcode"], #billing_postcode'),
			bodyPreview: await this.getBodyPreview(),
		}
	}

	private formatFieldSnapshot(label: string, snapshot: RegistrationFieldSnapshot) {
		return `${label}: exists=${snapshot.exists ? 'yes' : 'no'}, value="${snapshot.value}"`
	}

	private formatSubmitSnapshot(snapshot: RegistrationSubmitSnapshot) {
		return [
			`Submitted URL: ${snapshot.url}`,
			this.formatFieldSnapshot('Submitted address', snapshot.address),
			this.formatFieldSnapshot('Submitted billing_state', snapshot.billingState),
			this.formatFieldSnapshot('Submitted billing_postcode', snapshot.billingZip),
			`Submitted body preview: ${snapshot.bodyPreview}`,
		]
	}

	private async waitForOptionalInputValue(
		selector: string,
		fieldName: string,
		matches: (value: string) => boolean,
	) {
		const locator = this.page.locator(selector).first()

		if ((await locator.count()) === 0) {
			return ''
		}

		const deadline = Date.now() + 5000
		let lastValue = ''

		while (Date.now() < deadline) {
			lastValue = (await locator.inputValue().catch(() => '')).trim()

			if (matches(lastValue)) {
				return lastValue
			}

			await this.page.waitForTimeout(250)
		}

		throw new Error(
			[
				`Registration address ${fieldName} did not resolve after selecting autocomplete.`,
				`Last ${fieldName}: "${lastValue}"`,
				`Current URL: ${this.page.url()}`,
				`Address value: "${await this.address.inputValue().catch(() => '')}"`,
				`Body preview: ${await this.getBodyPreview()}`,
			].join('\n'),
		)
	}

	private async assertResolvedAddress(expectedState: string, expectedZip?: string) {
		const state = expectedState.toUpperCase()
		const zip = this.normalizeZip(expectedZip)

		await expect(this.address, 'Registration address was not populated.').not.toHaveValue('', {
			timeout: 5000,
		})

		await this.waitForOptionalInputValue(
			'select[name="billing_state"], input[name="billing_state"], #billing_state',
			'billing_state',
			value => value.trim().toUpperCase() === state,
		)

		if (zip) {
			await this.waitForOptionalInputValue(
				'input[name="billing_postcode"], #billing_postcode',
				'billing_postcode',
				value => this.normalizeZip(value) === zip,
			)
		}
	}

	private async waitForRegistrationReadyToSubmit(expectedState: string, expectedZip?: string) {
		const nextButton = this.page.getByRole('button', { name: /^next$/i })

		await this.page.waitForFunction(() => document.readyState !== 'loading')
		await this.assertResolvedAddress(expectedState, expectedZip)
		await expect(
			nextButton,
			'Registration Next button should be visible before submit.',
		).toBeVisible()
		await expect(
			nextButton,
			'Registration Next button should be enabled before submit.',
		).toBeEnabled()

		return nextButton
	}

	private async selectResolvedBillingAddress(
		address: string,
		expectedState: string,
		expectedZip?: string,
	) {
		await test.step('Enter Billing Address', async () => {
			await this.address.click()
			await this.address.fill('')
			await this.address.pressSequentially(address, { delay: 25 })

			const suggestion = this.page.locator('.pac-item').first()
			await suggestion.waitFor({ state: 'visible', timeout: 10000 })
			await suggestion.click()

			await this.assertResolvedAddress(expectedState, expectedZip)
		})
	}

	private isShopRouteBeforeEligibility() {
		const url = new URL(this.page.url())

		return (
			url.pathname === '/' &&
			['', '#', '#pickup', '#pickup-deliver', '#deliver'].includes(url.hash)
		)
	}

	private async recoverEligibilityStepFromShopRedirect() {
		test.info().annotations.push({
			type: 'Eligibility fallback',
			description:
				'Registration redirected to the shop before eligibility appeared; navigating to /my-account/eligibility/.',
		})

		await this.page.goto('/my-account/eligibility/', { waitUntil: 'domcontentloaded' })
	}

	private async throwSkippedEligibilityError(
		expectedState: string,
		expectedZip: string | undefined,
		submitSnapshot: RegistrationSubmitSnapshot,
	): Promise<never> {
		throw new Error(
			[
				'Registration skipped the eligibility/license step and redirected to the shop.',
				`Current URL: ${this.page.url()}`,
				`Expected state: ${expectedState}`,
				`Expected zip: ${expectedZip || 'not provided'}`,
				...this.formatSubmitSnapshot(submitSnapshot),
				`Current address: "${await this.inputValue('input[name="billing_address_1"]')}"`,
				`Current billing_state: "${await this.inputValue('select[name="billing_state"], input[name="billing_state"], #billing_state')}"`,
				`Current billing_postcode: "${await this.inputValue('input[name="billing_postcode"], #billing_postcode')}"`,
				`Current body preview: ${await this.getBodyPreview()}`,
			].join('\n'),
		)
	}

	private async waitForEligibilityStep(
		expectedState: string,
		expectedZip: string | undefined,
		submitSnapshot: RegistrationSubmitSnapshot,
	) {
		const deadline = Date.now() + 20000
		let attemptedEligibilityFallback = false

		while (Date.now() < deadline) {
			if (await this.isEligibilityLicenseStepVisible()) {
				return
			}

			if (
				!attemptedEligibilityFallback &&
				this.isShopRouteBeforeEligibility() &&
				!(await this.isEligibilityLicenseStepVisible())
			) {
				attemptedEligibilityFallback = true
				await this.recoverEligibilityStepFromShopRedirect()
				continue
			}

			await this.page.waitForTimeout(250)
		}

		if (
			!attemptedEligibilityFallback &&
			this.isShopRouteBeforeEligibility() &&
			!(await this.isEligibilityLicenseStepVisible())
		) {
			await this.throwSkippedEligibilityError(expectedState, expectedZip, submitSnapshot)
		}

		throw new Error(
			[
				'Eligibility/license step did not load after submitting the registration form.',
				`Current URL: ${this.page.url()}`,
				`Expected state: ${expectedState}`,
				`Expected zip: ${expectedZip || 'not provided'}`,
				...this.formatSubmitSnapshot(submitSnapshot),
				`Current address: "${await this.inputValue('input[name="billing_address_1"]')}"`,
				`Current billing_state: "${await this.inputValue('select[name="billing_state"], input[name="billing_state"], #billing_state')}"`,
				`Current billing_postcode: "${await this.inputValue('input[name="billing_postcode"], #billing_postcode')}"`,
				`Current body preview: ${await this.getBodyPreview()}`,
			].join('\n'),
		)
	}

	private async isEligibilityLicenseStepVisible() {
		const eligibilityContextVisible = await this.page
			.locator('#eligibilityContext')
			.first()
			.isVisible()
			.catch(() => false)
		const licenseInputVisible = await this.page
			.locator('input[name="svntn_core_personal_doc"]')
			.first()
			.isVisible()
			.catch(() => false)
		const usageTypeVisible = await this.page
			.locator('input[name="svntn_last_usage_type"]')
			.first()
			.isVisible()
			.catch(() => false)
		const completeAccountVisible = await this.page
			.getByText(/complete your account/i)
			.first()
			.isVisible()
			.catch(() => false)
		const idUploadVisible = await this.page
			.getByText(/id upload/i)
			.first()
			.isVisible()
			.catch(() => false)

		return (
			eligibilityContextVisible ||
			licenseInputVisible ||
			usageTypeVisible ||
			completeAccountVisible ||
			idUploadVisible
		)
	}

	private async submitNewCustomerForm(expectedState: string, expectedZip?: string) {
		await test.step('Submit New Customer Form', async () => {
			const nextButton = await this.waitForRegistrationReadyToSubmit(expectedState, expectedZip)
			const submitSnapshot = await this.registrationSubmitSnapshot()

			await nextButton.click()
			await this.waitForEligibilityStep(expectedState, expectedZip, submitSnapshot)
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
		address: string = '440 N Rodeo Dr, Beverly Hills, CA 90210',
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
			await this.selectResolvedBillingAddress(address, state, zipcode)
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

		await this.submitNewCustomerForm(state, zipcode)

		if (state !== 'FL') {
			await this.selectRegistrationUsageType(usage)
		}

		await this.uploadPersonalDocument('CA-DL.jpg')

		await test.step('Enter Drivers License Exp', async () => {
			await this.driversLicenseExpMonth.selectOption('12')
			await this.driversLicenseExpDay.selectOption('16')
			await this.driversLicenseExpYear.selectOption(`${new Date().getFullYear() + 1}`)
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
				await this.page.getByRole('button', { name: /register/i }).click()
				await this.page.waitForTimeout(5000)
				await expect(this.page).toHaveURL('/#deliver')
			})
		} else {
			await test.step('Complete Usage Type Form', async () => {
				await this.page.getByRole('button', { name: /register/i }).click()
				await this.page.waitForTimeout(5000)
				await expect(this.page.url()).toMatch(/\/(?:#pickup-deliver|#pickup)?$/)
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

		const addressState = this.inferStateFromAddress(address) || 'MI'
		const addressZip = this.inferZipFromAddress(address)
		await this.selectResolvedBillingAddress(address, addressState, addressZip)

		await test.step('Enter Phone Number', async () => {
			await this.phoneNumber.click()
			await this.phoneNumber.fill(`${phone}`)
		})

		await this.submitNewCustomerForm(addressState, addressZip)

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
			await this.page.getByRole('button', { name: 'Register' }).click()
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

		await this.selectResolvedBillingAddress(address, 'CA', this.inferZipFromAddress(address))

		await test.step('Enter Phone Number', async () => {
			await this.phoneNumber.click()
			await this.phoneNumber.fill(`${phone}`)
		})

		await this.submitNewCustomerForm('CA', this.inferZipFromAddress(address))

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
			await this.page.getByRole('button', { name: 'Register' }).click()
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
		address: string = '933 Alpine Ave, Boulder, CO 80304',
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
			await this.selectResolvedBillingAddress(address, state, zipcode)
		}

		await test.step('Enter Phone Number', async () => {
			await this.phoneNumber.click()
			await this.phoneNumber.fill(faker.phone.phoneNumber('555-###-####'))
		})

		await this.submitNewCustomerForm(state, zipcode)

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
			await this.page.getByRole('button', { name: /register/i }).click()
			await this.page.waitForTimeout(5000)
			await expect(this.page.url()).toMatch(/\/#pickup-deliver|\/#pickup$/)
		})

		if (logout) {
			await this.page.goto('/my-account')
			await this.page.locator('text=Logout').click()
		}
	}
}
