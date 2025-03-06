require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')
export class AccountPage {
	readonly alwaysOnUsername: string
	readonly alwaysOnPassword: string
	readonly NEWalwaysOnPassword: string

	readonly page: Page
	readonly pageTitleSelector: Locator
	readonly accountButtonNav: Locator
	readonly signOutButton: Locator
	readonly signOutLink: Locator
	// Orders
	readonly ordersSection: Locator
	readonly orderHistoryHeader: Locator
	readonly viewAllOrdersLink: Locator
	readonly orderSummariesRows: Locator
	// Address
	readonly addressesSection: Locator
	readonly currentAddressDisplayed: Locator

	readonly editAddressesLink: Locator
	readonly addressDrawerHeader: Locator
	readonly addNewAddressButton: Locator
	readonly addressField: Locator
	readonly addressSubmitButton: Locator
	// Personal Info
	readonly personalInfoHeader: Locator
	readonly editPersonalInfoLink: Locator
	readonly personalInfoDrawerHeader: Locator
	readonly firstNameInput: Locator
	readonly lastNameInput: Locator
	readonly emailInput: Locator
	readonly phoneInput: Locator
	readonly birthdayInput: Locator
	readonly persInfoUpdateButton: Locator
	readonly displayedUserFirstName: Locator
	readonly displayedUserLastName: Locator
	readonly displayedUserEmail: Locator
	readonly displayedUserPhone: Locator
	readonly displayedUserDOB: Locator
	// Photo ID
	readonly photoIdSection: Locator
	readonly editPhotoIdLink: Locator
	readonly photoDrawerHeader: Locator
	readonly uploadIDInput: Locator
	readonly addReplaceButton: Locator
	readonly idError: Locator
	readonly expirationLabel: Locator
	readonly expirationInput: Locator
	readonly expirationError: Locator

	readonly photoIDSaveAndContinueButton: Locator
	readonly dispalyedPhotoIDImage: Locator
	readonly dispalyedPhotoIDExp: Locator

	// MED ID
	readonly medicalCardSection: Locator
	readonly editMedicalCardLink: Locator
	readonly medDrawerHeader: Locator
	readonly medCardInput: Locator
	readonly addMedCardButton: Locator
	readonly medStateDropDown: Locator
	readonly issuingStateError: Locator
	readonly medExpDateInput: Locator
	readonly medExpDateError: Locator
	readonly medSaveAndContinueButton: Locator
	readonly dispalyedMedIDImage: Locator
	readonly dispalyedMedIDExp: Locator
	// PASSWORD
	readonly passwordSection: Locator
	readonly editPasswordLink: Locator
	readonly passwordDrawerHeader: Locator
	readonly currentPasswordInput: Locator
	readonly newPasswordInput: Locator
	readonly changePasswordButton: Locator
	readonly currentPasswordError: Locator
	readonly newPasswordError: Locator

	constructor(page: Page) {
		this.page = page
		this.alwaysOnUsername = process.env.ALWAYS_ON_USERNAME || ''
		this.alwaysOnPassword = process.env.ALWAYS_ON_PASSWORD || ''
		this.NEWalwaysOnPassword = process.env.NEW_ALWAYS_ON_PASSWORD || ''
		this.pageTitleSelector = page.locator('span.site-header-group')
		this.accountButtonNav = page.locator('svg.icon.icon-account')
		this.signOutButton = page.locator('a:has-text("Sign out")')
		// Order History
		this.ordersSection = page.locator('#orders')
		this.orderHistoryHeader = page.locator('h3:has-text("Order history")')
		this.viewAllOrdersLink = page.locator('a:has-text("View all orders")')
		this.orderSummariesRows = page.locator('.order-summary-row')
		// Addresses
		this.addressesSection = page.locator('h3:has-text("Addresses")')
		this.currentAddressDisplayed = page.locator('p.--reactive-long-origin')
		this.editAddressesLink = page.locator('a.specific-link[data-module="fulfillment"]')
		this.addressDrawerHeader = page.locator('h2:has-text("Enter your address")')
		this.addNewAddressButton = page.locator('label:has-text("Add new address")')
		this.addressField = page.locator('#fasd_address')
		this.addressSubmitButton = page.locator('button.wpse-button-primary.fasd-form-submit')
		// Personal Info
		this.personalInfoHeader = page.locator('h3:has-text("Personal info")')
		this.editPersonalInfoLink = page.locator('a.specific-link[data-module="personal"]')
		this.personalInfoDrawerHeader = page.locator('h2:has-text("Your information")')
		this.firstNameInput = page.locator('input#fasd_fname')
		this.lastNameInput = page.locator('input#fasd_lname')
		this.emailInput = page.locator('input#fasd_email')
		this.phoneInput = page.locator('input#fasd_phone')
		this.birthdayInput = page.locator('input#fasd_dob').nth(1)
		this.persInfoUpdateButton = page.locator('a.wpse-button-primary.fasd-form-submit').nth(2)
		this.displayedUserFirstName = page.locator('span.--reactive-user-fname')
		this.displayedUserLastName = page.locator('span.--reactive-user-lname')
		this.displayedUserEmail = page.locator('p.--reactive-user-email')
		this.displayedUserPhone = page.locator('p.--reactive-user-phone')
		this.displayedUserDOB = page.locator('p.--reactive-user-dob')
		// Photo ID
		this.photoIdSection = page.locator('h3:has-text("Photo ID")')
		this.editPhotoIdLink = page.locator('a.specific-link[data-module="iddoc"]')
		this.photoDrawerHeader = page.locator('h2:has-text("Replace your ID on file")')
		this.uploadIDInput = page.locator('input#fasd_doc')
		this.addReplaceButton = page.locator('button.wpse-button-secondary.fasd-file-pseudobutton')
		this.idError = page.locator('p#fasd_doc_error')
		this.expirationLabel = page.locator('label[for="doc_exp"]')
		this.expirationInput = page.locator('input#doc_exp')
		this.expirationError = page.locator('p#doc_exp_error')
		this.photoIDSaveAndContinueButton = page
			.locator('a.wpse-button-primary.fasd-form-submit')
			.first()
		this.dispalyedPhotoIDImage = page.locator(
			'div.wpse-account-component:has(header:has-text("Photo ID")) img',
		)
		this.dispalyedPhotoIDExp = page.locator('.wpse-document-meta p').first()
		// Medical Card
		this.medicalCardSection = page.locator('h3:has-text("Medical card")')
		this.editMedicalCardLink = page.locator('a.specific-link[data-module="meddoc"]')
		this.medDrawerHeader = page.locator('h2:has-text("Replace your med card on file")')
		this.medCardInput = page.locator('input#fasd_medcard')
		this.addMedCardButton = page.locator('button.wpse-button-secondary.fasd-file-pseudobutton')
		this.medStateDropDown = page.locator('select#medcard_state')
		this.issuingStateError = page.locator('p#medcard_state_error')
		this.medExpDateInput = page.locator('input#medcard_exp')
		this.medExpDateError = page.locator('p#medcard_exp_error')
		this.medSaveAndContinueButton = page.locator('a.wpse-button-primary.fasd-form-submit').nth(1)
		this.dispalyedMedIDImage = page.locator(
			'div.wpse-account-component:has(header:has-text("Medical card")) section#render_medcard_summary img',
		)
		this.dispalyedMedIDExp = page.locator('.wpse-document-meta p').nth(1)
		// Password
		this.passwordSection = page.locator('h3:has-text("Sign on & security")')
		this.editPasswordLink = page.locator('a.specific-link[data-module="password"]')
		this.passwordDrawerHeader = page.locator('h2:has-text("Change password")')
		this.currentPasswordInput = page.locator('#old_password')
		this.newPasswordInput = page.locator('#new_password')
		this.changePasswordButton = page.locator('button.wpse-button-secondary.fasd-form-submit')
		this.currentPasswordError = page.locator('#old_password_error')
		this.newPasswordError = page.locator('#new_password_error')
	}
	async goToAccountPage() {
		// verify page title, logo, account and cart button are visible
		await this.accountButtonNav.waitFor({ state: 'visible' })
		await expect(this.accountButtonNav).toBeVisible()
		// click account button in nav bar
		await this.accountButtonNav.click()
		await this.page.waitForTimeout(2000)
		// Verify page title is visible
		await expect(this.pageTitleSelector).toBeVisible()
		// Verify Account button is visible
		await expect(this.accountButtonNav).toBeVisible()
		// Verify Sign Out link is visible and clickable
		await expect(this.signOutButton).toBeVisible()
	}
	async verifyAccountPageElements(userType, noOrders, currentPassword, newPassword) {
		await this.page.waitForTimeout(2000)
		// verify & edit Address Info
		await this.enterAddressInfo(noOrders)
		// edit personal info
		const newEmail = await this.editPersonalInfo(userType)
		// add photo id
		await this.editPhotoId()
		// if userType is med, then add med card info
		if (userType === 'med') {
			// Verify Medical Card section
			await this.editMedicalCard()
		}
		// verify password change
		await this.editPassword(currentPassword, newPassword)

		console.log('All account page elements verified successfully.')
		//return email to login with updated password
		return newEmail
	}
	async logOut(page) {
		await test.step('Log out User', async () => {
			await this.goToAccountPage()
			// verify that sign out button appears
			await this.signOutButton.waitFor({ state: 'visible' })
			await expect(this.signOutButton).toBeVisible()
			await this.signOutButton.click()
		})
	}
	async navigateToOrders() {
		await this.ordersSection.scrollIntoViewIfNeeded()
		await this.viewAllOrdersLink.click()
	}
	async verifyOrderHistoryLoads() {
		// Verify Orders section
		await expect(this.orderHistoryHeader).toBeVisible()
		await expect(this.viewAllOrdersLink).toBeVisible()

		// Test clicking "View All Orders" and navigate back
		await this.viewAllOrdersLink.click()
		await this.page.goBack() // Navigate back to account page
	}
	// if being used when account has NO orders, pass true, if account already has orders, pass false
	async enterAddressInfo(noOrders) {
		// Verify Address section & link appear
		await this.page.waitForTimeout(2000)
		await expect(this.addressesSection).toBeVisible()
		// click on edit address button
		await this.editAddressesLink.waitFor({ state: 'visible' })
		await expect(this.editAddressesLink).toBeVisible()
		if (noOrders === true) {
			await this.editAddressesLink.click()
			//await this.editAddressesLink.click()
		} else {
			await this.editAddressesLink.click()
			//await this.editAddressesLink.click()
		}

		//expect Header to be visible in drawer
		await this.addressDrawerHeader.waitFor({ state: 'visible' })
		await expect(this.addressDrawerHeader).toBeVisible()
		// click add new address button
		await expect(this.addNewAddressButton).toBeVisible()
		await this.addNewAddressButton.click()
		//enter new address into address field
		await this.addressField.waitFor({ state: 'visible' })
		await expect(this.addressField).toBeVisible()

		const newAddress = '6801 Hollywood Blvd, Los Angeles, CA 90028'

		// Type the address into the text field
		await this.addressField.fill(newAddress)

		// Wait for the autocomplete suggestions to appear
		await this.page.waitForSelector('.pac-item') // Replace with the actual class or selector of the autocomplete suggestion items

		// Press 'ArrowDown' to navigate to the first suggestion and then press 'Enter' to select it
		await this.addressField.press('ArrowDown')
		await this.addressField.press('Enter')
		await this.page.waitForTimeout(2000)
		await this.addressSubmitButton.click()
		//await this.addressSubmitButton.click()

		//verify that account page now shows the updated address
		expect(this.currentAddressDisplayed).toHaveText(newAddress)
	}
	async editPersonalInfo(userType) {
		// Verify Personal Info section
		await expect(this.personalInfoHeader).toBeVisible()
		await expect(this.editPersonalInfoLink).toBeVisible()
		// click "Edit Personal Info" and navigate back
		await this.personalInfoHeader.scrollIntoViewIfNeeded()
		await this.editPersonalInfoLink.click()
		//expect Header to be visible in drawer
		await this.personalInfoDrawerHeader.waitFor({ state: 'visible' })
		await expect(this.personalInfoDrawerHeader).toBeVisible()
		await this.firstNameInput.waitFor({ state: 'visible' })
		await expect(this.firstNameInput).toBeVisible()
		// Edit input fields
		const newFirstName = 'Edited First Name'
		const newLastName = 'Edited Last Name'
		await this.firstNameInput.fill(newFirstName)
		await this.lastNameInput.fill(newLastName)
		const now = new Date()
		// Construct the timestamp string with date and time
		const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
			now.getDate(),
		).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(
			now.getMinutes(),
		).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}-${String(
			now.getMilliseconds(),
		).padStart(3, '0')}`

		// enter a unique test email for test user
		const newEmail = `edited_user_${userType}_${timestamp}@test.com`
		console.log(`\n New user email ---> ${newEmail} \n`)
		await this.emailInput.fill(newEmail)
		//edit phone number
		const generatePhoneNumber = () => {
			const randomDigits = Math.floor(Math.random() * 9000000) + 1000000
			return `555-${randomDigits}`
		}
		const newPhone = generatePhoneNumber()
		await this.phoneInput.click()
		await this.phoneInput.fill(newPhone)
		await this.birthdayInput.click()
		const newBirthday = '01/02/1985'
		await this.birthdayInput.type(newBirthday)
		// click Update button
		await expect(this.personalInfoHeader).toBeVisible()
		await this.persInfoUpdateButton.click()
		await this.page.waitForTimeout(2000)
		// Verify that displayed Pers Info matches updates
		expect(this.displayedUserFirstName).toHaveText(newFirstName)
		expect(this.displayedUserLastName).toHaveText(newLastName)
		expect(this.displayedUserEmail).toHaveText(newEmail)
		const phoneNormalizedReceived2 = await this.normalizePhoneNumber(
			await this.displayedUserPhone.textContent(),
		)
		const phoneNormalizedExpected2 = await this.normalizePhoneNumber(newPhone)
		// Perform the assertion
		expect(phoneNormalizedReceived2).toBe(phoneNormalizedExpected2)
		//expect(this.displayedUserPhone).toHaveText(newPhone)
		expect(this.displayedUserDOB).toHaveText(newBirthday)
		// return Email to use later
		return newEmail
	}

	async editPhotoId() {
		// Verify Photo ID section
		await expect(this.photoIdSection).toBeVisible()
		await expect(this.editPhotoIdLink).toBeVisible()
		// Click "Edit Photo ID" and navigate back
		await this.photoIdSection.scrollIntoViewIfNeeded()
		await this.editPhotoIdLink.click()
		//expect Header to be visible in drawer
		await this.photoDrawerHeader.waitFor({ state: 'visible' })
		await expect(this.photoDrawerHeader).toBeVisible()
		await this.uploadIDInput.waitFor({ state: 'visible' })
		await expect(this.uploadIDInput).toBeVisible()
		// add id image file
		const [driversLicenseChooser] = await Promise.all([
			this.page.waitForEvent('filechooser'),
			this.uploadIDInput.click(),
		])
		//Enter Personal ID info (Med already exists from pre-cart step)
		await driversLicenseChooser.setFiles('Medical-Card.png')
		// Add Exp date
		await this.expirationInput.click()
		const newYear = new Date().getFullYear() + 1
		const personalExpDate = `04/10/${newYear}`
		await this.expirationInput.type(personalExpDate)
		// click save and continue button
		await expect(this.photoIDSaveAndContinueButton).toBeVisible()
		await this.photoIDSaveAndContinueButton.click()
		// Verify that Exp date matches inputted value
		await this.page.waitForTimeout(1000)
		expect(this.dispalyedPhotoIDExp).toHaveText(`Exp: ${personalExpDate}`)
		// Verify that saved image popuates
		// Call the function to verify the image
		// const imageContainerSelector = 'div.wpse-account-component:has(header:has-text("Photo ID")) img'
		// const isImagePopulated = await this.verifyImageIsPopulated(imageContainerSelector, this.page)
		// expect(isImagePopulated).toBe(true)
	}

	async editMedicalCard() {
		// Verify Photo ID section
		await expect(this.medicalCardSection).toBeVisible()
		await expect(this.editMedicalCardLink).toBeVisible()
		// Click "Edit Photo ID" and navigate back
		await this.editMedicalCardLink.scrollIntoViewIfNeeded()
		await this.editMedicalCardLink.click()
		//expect Header to be visible in drawer
		await this.medDrawerHeader.waitFor({ state: 'visible' })
		await expect(this.medDrawerHeader).toBeVisible()
		await this.medCardInput.waitFor({ state: 'visible' })
		await expect(this.medCardInput).toBeVisible()
		// add id image file
		const [medCardLicenseChooser] = await Promise.all([
			this.page.waitForEvent('filechooser'),
			this.medCardInput.click(),
		])
		//Enter Personal ID info (Med already exists from pre-cart step)
		await medCardLicenseChooser.setFiles('Medical-Card.png')
		// add issuing state
		await this.medStateDropDown.selectOption('CA')
		// Add Exp date
		await this.medExpDateInput.click()
		const newYear = new Date().getFullYear() + 1
		const medExpDate = `04/10/${newYear}`
		await this.medExpDateInput.type(medExpDate)
		// medcard #
		const medCardNumber = this.page.locator('input#medcard_no')
		const length = Math.floor(Math.random() * 9) + 1
		const randomInteger = Math.floor(Math.random() * 10 ** length)
		await medCardNumber.click()
		await medCardNumber.type(`${randomInteger}`)
		const firstDate = '01/01/1990'
		const medBirthday = this.page.locator('#fasd_dob')
		await medBirthday.click()
		await medBirthday.type(firstDate)
		// click save and continue button
		await expect(this.medSaveAndContinueButton).toBeVisible()
		await this.medSaveAndContinueButton.click()
		// Verify that Exp date matches inputted value
		await this.page.waitForTimeout(1000)
		expect(this.dispalyedMedIDExp).toHaveText(`Exp: ${medExpDate}`)

		// Verify that saved image popuates
		// Call the function to verify the image
		// const imageContainerSelector =
		// 	'div.wpse-account-component:has(header:has-text("Medical card")) section#render_medcard_summary img'
		// const isImagePopulated = await this.verifyImageIsPopulated(imageContainerSelector, this.page)
		// expect(isImagePopulated).toBe(true)
	}

	async editPassword(currentPassword, newPassword) {
		// Verify Password section
		await expect(this.passwordSection).toBeVisible()
		await expect(this.editPasswordLink).toBeVisible()
		await this.passwordSection.scrollIntoViewIfNeeded()
		await this.editPasswordLink.click()
		//wait for drawer header
		await this.passwordDrawerHeader.waitFor({ state: 'visible' })
		await expect(this.passwordDrawerHeader).toBeVisible()
		await this.passwordDrawerHeader.waitFor({ state: 'visible' })
		// enter current password
		await this.currentPasswordInput.fill(currentPassword)
		await this.page.waitForTimeout(1500)
		// enter new password
		await this.newPasswordInput.fill(newPassword)
		await this.page.waitForTimeout(1500)
		//click change password button
		await expect(this.changePasswordButton).toBeVisible()
		await this.changePasswordButton.click()
		await this.page.waitForTimeout(1000)
	}
	async normalizePhoneNumber(phone) {
		// Remove all non-numeric characters first
		const digitsOnly = phone.replace(/\D/g, '')
		// Reformat to XXX-XXX-XXXX
		return digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
	}
	async verifyImageIsPopulated(selector: string, page: Page): Promise<boolean> {
		// Wait for the selector to be visible
		await page.waitForSelector(selector, { state: 'visible' })

		// Get the `src` attribute of the image
		const imageSrc = await page.locator(`${selector} img`).getAttribute('src')

		// Verify the `src` attribute is not null or empty
		if (imageSrc && imageSrc.trim() !== '') {
			console.log(`Image is populated with src: ${imageSrc}`)
			return true
		} else {
			console.log('Image src is empty or not found.')
			return false
		}
	}
}
module.exports = { AccountPage }
