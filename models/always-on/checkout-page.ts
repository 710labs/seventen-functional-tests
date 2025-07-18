require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')
import { faker } from '@faker-js/faker'

export class CheckoutPage {
	readonly page: Page
	readonly checkoutPageTitle: Locator
	readonly yourInfoSection: Locator
	readonly phoneInputField: Locator
	readonly birthdayInputField: Locator
	readonly saveContinueButton: Locator
	readonly saveContinueButtonInfoSection: Locator
	readonly saveContinueButtonPersonalDocument: Locator
	readonly documentsSection: Locator
	readonly idExpirationInput: Locator
	readonly medExpirationInput: Locator
	readonly deliveryAppointmentSection: Locator
	readonly deliveryDayInputField: Locator
	readonly deliveryTimeInputField: Locator
	readonly saveContinueButtonDelivery: Locator
	readonly paymentSection: Locator
	readonly cashOption: Locator
	readonly AeropayOption: Locator
	readonly saveContinueButtonPayment: Locator
	readonly orderReviewSection: Locator
	readonly placeOrderButton: Locator
	readonly pickUpLocationTitle: Locator
	readonly editButtonGenericLocator: Locator
	readonly editAddressInfoButton: Locator
	readonly editPhoneInfoButton: Locator
	readonly editDocumentInfoButton: Locator
	readonly editDeliveryInfoButton: Locator
	readonly editPaymentInfoButton: Locator
	readonly displayedDeliveryAddress: Locator
	readonly displayedAppointment: Locator
	readonly displayedFirstName: Locator
	readonly displayedLastName: Locator
	readonly displayedEmail: Locator
	readonly displayedPhoneNumber: Locator
	readonly displayedBirthday: Locator
	readonly displayedPersonalExp: Locator
	readonly displayedMedicalExp: Locator
	readonly displayPayment: Locator
	readonly displayedAddress: Locator
	readonly addNewAddressButton: Locator
	readonly addressField: Locator
	readonly changeDeliveryPopUp: Locator
	readonly yesChangeAddressButton: Locator
	readonly firstNameField: Locator
	readonly lastNameField: Locator
	readonly emailField: Locator
	readonly saveContinueButtonAddress: Locator
	readonly passwordCheckoutField: Locator
	readonly passwordError: Locator
	readonly submitPasswordButton: Locator
	constructor(page: Page) {
		this.page = page
		this.checkoutPageTitle = page.locator('h2:has-text("Checkout")')
		this.yourInfoSection = page.locator('#checkout_info_step')
		this.phoneInputField = page.locator('#fasd_phone')
		this.birthdayInputField = page.locator('#fasd_dob')
		this.saveContinueButton = page.locator('a.wpse-button-primary.fasd-form-submit')
		this.saveContinueButtonInfoSection = page.locator('a.wpse-button-primary.fasd-form-submit')
		this.saveContinueButtonPersonalDocument = page.locator('a.wpse-button-primary.fasd-form-submit')
		this.saveContinueButtonAddress = page.locator('button.wpse-button-primary.fasd-form-submit')
		this.documentsSection = page.locator('#checkout_id')
		this.idExpirationInput = page.locator('#doc_exp')
		this.medExpirationInput = page.locator('#medcard_exp')
		this.deliveryAppointmentSection = page.locator(
			'#checkout_appointment.wpse-checkout-subcomponent',
		)
		this.deliveryDayInputField = page.locator('#date_type.fasd-form-value.fasd-change-selfsubmit')
		this.deliveryTimeInputField = page.locator('#time_type.fasd-form-value.fasd-change-autosubmitx')
		this.saveContinueButtonDelivery = page
			.locator('a.wpse-button-primary.fasd-form-submit[href="#0"]')
			.nth(2)
		this.paymentSection = page.locator('div#checkout_payment_step')
		this.cashOption = page.locator('label[for="cash"]')
		this.AeropayOption = page.locator('label[for="debit"]')
		this.saveContinueButtonPayment = page
			.locator('a.wpse-button-primary.fasd-form-submit[href="#0"]')
			.nth(2)
		this.orderReviewSection = page.locator('#checkout_checkout')
		this.placeOrderButton = page.locator("//button[@id='place_order']")
		this.pickUpLocationTitle = page.locator('h2:has-text("Pickup Location")')
		this.editButtonGenericLocator = page.locator('a.wpse-checkout-unroller')
		this.editAddressInfoButton = page.locator('a.wpse-checkout-unroller:has-text("Edit")').first()
		this.editPhoneInfoButton = page.locator('a.wpse-checkout-unroller:has-text("Edit")').nth(2)
		this.editDocumentInfoButton = page.locator('a.wpse-checkout-unroller:has-text("Edit")').nth(3)
		this.editDeliveryInfoButton = page.locator('a.wpse-checkout-unroller:has-text("Edit")').nth(0)
		this.editPaymentInfoButton = page.locator('a.wpse-checkout-unroller:has-text("Edit")').nth(4)
		this.displayPayment = page.locator('p.--reactive-pymnt')
		this.displayedDeliveryAddress = page.locator('.--reactive-long-origin')
		this.displayedAppointment = page.locator('#render_appt_summary')
		this.displayedFirstName = page.locator('span.--reactive-user-fname')
		this.displayedLastName = page.locator('span.--reactive-user-lname')
		this.displayedEmail = page.locator('p.--reactive-user-email')
		this.displayedPhoneNumber = page.locator('.--reactive-user-phone')
		this.displayedBirthday = page.locator('p.--reactive-user-dob')
		this.displayedPersonalExp = page.locator('div.wpse-document-meta p').first()
		this.displayedMedicalExp = page.locator('div.wpse-document-meta p').nth(1)
		this.addNewAddressButton = page.locator('label:has-text("Add new address")')
		this.addressField = page.locator('#fasd_address')
		this.changeDeliveryPopUp = page.locator(
			'div.wpse-snacktoast.warn-toast:has-text("You\'re changing delivery zones")',
		)
		this.yesChangeAddressButton = page.locator(
			'button.wpse-button-primary.fasd-form-submit:has-text("Yes, change address")',
		)
		this.displayedAddress = page.locator('p.--reactive-long-origin')
		this.firstNameField = page.locator('#fasd_fname')
		this.lastNameField = page.locator('#fasd_lname')
		this.emailField = page.locator('#fasd_email')
		this.passwordCheckoutField = page.locator('#dev_pswrd')
		this.passwordError = page.locator('p.fasd-input-error#dev_pswrd_error')
		this.submitPasswordButton = page.locator(
			'a.wpse-button-primary.fasd-form-submit:has-text("Submit")',
		)
	}
	//
	// recEnterInfoForCheckoutAndEdit currently used by both Live and Concierge REC tests
	async recEnterInfoForCheckoutAndEdit(page, addressParam, newAddressParam) {
		const isPickupVisible = await this.pickUpLocationTitle.isVisible()
		await test.step('Address for Delivery', async () => {
			if (!isPickupVisible) {
				//Verify that checkout page displays original address entered previously
				await expect(this.displayedAddress).toHaveText(addressParam)
				await page.waitForTimeout(1000)
				// Edit delivery address
				await this.editButtonGenericLocator.first().waitFor({ state: 'visible' })
				await this.editButtonGenericLocator.first().click()
				await page.waitForTimeout(2000)
				//click the add new address button
				await this.addNewAddressButton.waitFor({ state: 'visible', timeout: 10000 }) // 30 seconds timeout
				await expect(this.addNewAddressButton).toBeVisible()
				await this.addNewAddressButton.click()
				// Type the address into the text field
				await this.addressField.waitFor({ state: 'visible', timeout: 10000 })
				await expect(this.addressField).toBeVisible()
				await this.addressField.click()
				const newAddress = newAddressParam
				await this.addressField.fill(newAddress)
				const dropDownSelector = page.locator('.pac-item')
				// Wait for the autocomplete suggestions to appear
				await this.page.waitForSelector('.pac-item') // Replace with the actual class or selector of the autocomplete suggestion items
				// Press 'ArrowDown' to navigate to the first suggestion and then press 'Enter' to select it
				// await this.addressField.press('ArrowDown')
				// await this.addressField.press('Enter')
				await dropDownSelector.first().click()
				await page.waitForTimeout(1000)
				//await this.checkoutPageTitle.click()
				await this.saveContinueButtonAddress.first().click()
				await page.waitForTimeout(1500)
				// Verify that Change delivery zones pops up
				//await expect(this.changeDeliveryPopUp).toBeVisible()
				//await expect(this.changeDeliveryPopUp).toContainText("You're changing delivery zones")
				//await expect(this.yesChangeAddressButton).toBeVisible()
				//await this.yesChangeAddressButton.click()
				//Verify that address was updated correctly
				const expectedNewTextDisplay = `2919 S La Cienega Blvd, Culver City, CA 90232`
				await expect(this.displayedAddress).toHaveText(expectedNewTextDisplay)
			}
		})
		await test.step('Delivery Appointment Section', async () => {
			if (!isPickupVisible) {
				await this.deliveryDayInputField.waitFor({ state: 'visible' })
				await this.deliveryDayInputField.selectOption({ index: 1 })
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				const initialDayValue = await this.deliveryDayInputField.inputValue()
				//const initialTimeValue = await this.deliveryTimeInputField.inputValue()
				// Retrieve the displayed text of the selected option
				const initialTimeValue = await page.locator('#time_type option:checked').innerText()
				console.log('Selected Text:', initialTimeValue)
				await this.saveContinueButton.nth(0).click()
				const appointmentSummary = this.displayedAppointment
				const dateText = appointmentSummary.locator('p').nth(0)
				const timeText = appointmentSummary.locator('p').nth(1)
				const reformattedDateExpectedInitialDayValue = await this.reformatDateToLongFormat(
					initialDayValue,
				)
				await expect(dateText).toHaveText(reformattedDateExpectedInitialDayValue)
				await expect(timeText).toHaveText(initialTimeValue)

				// Edit and verify updated delivery day and time
				await this.editButtonGenericLocator.nth(1).click()
				await this.deliveryDayInputField.waitFor({ state: 'visible' })
				await this.deliveryDayInputField.selectOption({ index: 1 })
				await page.waitForTimeout(750)
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				await page.waitForTimeout(2000)
				const updatedDayValue = await this.deliveryDayInputField.inputValue()
				const updatedTimeValue = await page.locator('#time_type option:checked').innerText()
				await this.saveContinueButton.nth(0).click()
				await page.waitForTimeout(2000)

				// erify appointment date/time
				const updatedReformattedDateExpectedUpdatedDayValue = await this.reformatDateToLongFormat(
					updatedDayValue,
				)
				await expect(dateText).toHaveText(updatedReformattedDateExpectedUpdatedDayValue)
				await expect(timeText).toHaveText(updatedTimeValue)
			}
		})
		await test.step('Phone and Birthday input', async () => {
			console.log('Editing phone and birthday')
			//await this.editButtonGenericLocator.first().waitFor({ state: 'visible' })

			// Retry loop to ensure phone input field becomes visible
			// let retryCount = 0
			// const maxRetries = 5
			// while (retryCount < maxRetries) {
			// 	await this.editButtonGenericLocator.first().click({ force: true })
			// 	await this.page.waitForTimeout(1000) // Small wait between attempts

			// 	// Check if phone input field is visible
			// 	const isPhoneFieldVisible = await this.phoneInputField.isVisible()
			// 	if (isPhoneFieldVisible) {
			// 		console.log(`Phone input field is visible after ${retryCount + 1} attempt(s)`)
			// 		break
			// 	}

			// 	retryCount++
			// 	console.log(`Phone input field not visible, retry ${retryCount}/${maxRetries}`)

			// 	if (retryCount === maxRetries) {
			// 		throw new Error(`Phone input field did not become visible after ${maxRetries} attempts`)
			// 	}
			// }

			await this.phoneInputField.waitFor({ state: 'visible' })
			console.log('After clicking edit button')
			const indexPersonalInfoSave = isPickupVisible ? 0 : 1
			const indexPersonalInfoEdit = isPickupVisible ? 0 : 2
			// Function to generate a random phone number
			const generatePhoneNumber = () => {
				const randomDigits = Math.floor(Math.random() * 9000000) + 1000000
				return `555-${randomDigits}`
			}
			// Enter initial phone number and birthday
			let phoneErrorExists = true
			let phoneNumber
			const firstDate = '01/01/1990'
			while (phoneErrorExists) {
				phoneNumber = generatePhoneNumber()
				await this.phoneInputField.waitFor({ state: 'visible' })
				await this.phoneInputField.fill(phoneNumber)
				await this.birthdayInputField.click()
				await this.birthdayInputField.type(firstDate)
				const initialPhoneNum = await this.phoneInputField.inputValue()
				const initialBirthday = await this.birthdayInputField.inputValue()
				await this.page.click('body')
				await this.page.waitForTimeout(1000)
				await this.saveContinueButton.nth(indexPersonalInfoSave).click()
				await this.page.waitForTimeout(4000)
				phoneErrorExists = await page.isVisible('#fasd_phone_error:has-text("Already in use")')
				//Verify that phone & email display correctly (needs to be inside due to format)
				//reformat phone number to match
				const normalizedReceived = await this.normalizePhoneNumber(
					await this.displayedPhoneNumber.textContent(),
				)
				const normalizedExpected = await this.normalizePhoneNumber(initialPhoneNum)
				// Verify that displayed equals Initial values
				expect(normalizedReceived).toBe(normalizedExpected)
				expect(this.displayedBirthday).toHaveText(firstDate)
			}
			// Edit phone number and birthday
			await this.editButtonGenericLocator.nth(indexPersonalInfoEdit).click()
			const newPhoneNumber = generatePhoneNumber()
			await this.phoneInputField.fill(newPhoneNumber)
			const newDate = '02/02/1992'
			await this.birthdayInputField.click()
			await this.birthdayInputField.type(newDate)
			// TODO: Edit First/Last name and Email
			const newFirstName = faker.name.firstName?.() || faker.person.firstName()
			const newLastName = faker.name.lastName?.() || faker.person.lastName()
			await this.firstNameField.fill(newFirstName)
			await this.lastNameField.fill(newLastName)
			// save edits
			await this.saveContinueButton.nth(indexPersonalInfoSave).click({ force: true })
			await page.waitForTimeout(2000)
			// TODO: ADD for newEmail
			//const newEmail =
			// TODO: Verify edits to First/Last, Email, Phone, and Birthday
			expect(this.displayedFirstName).toHaveText(newFirstName)
			// Fix for special characters like apostrophes in last names
			const displayedLastName = (await this.displayedLastName.textContent()) || ''
			expect(displayedLastName.replace(/\\/g, '')).toEqual(newLastName)
			//expect(this.displayedEmail).toHaveText(newEmail)
			const normalizedReceived2 = await this.normalizePhoneNumber(
				await this.displayedPhoneNumber.textContent(),
			)
			const normalizedExpected2 = await this.normalizePhoneNumber(newPhoneNumber)
			// Perform the assertion
			expect(normalizedReceived2).toBe(normalizedExpected2)
			//expect(this.displayedPhoneNumber).toHaveText(newPhoneNumber)
			expect(await this.displayedBirthday).toHaveText(newDate)
		})
		await test.step('Personal Document section', async () => {
			const indexDocumentsSave = isPickupVisible ? 1 : 2
			const indexDocumentsEdit = isPickupVisible ? 1 : 3
			const dlUploadButton = await this.page.waitForSelector('#fasd_doc')
			const [driversLicenseChooser] = await Promise.all([
				this.page.waitForEvent('filechooser'),
				dlUploadButton.click(),
			])
			//Enter Personal ID info (Med already exists from pre-cart step)
			await driversLicenseChooser.setFiles('Medical-Card.png')
			await this.idExpirationInput.click()
			const newYear = new Date().getFullYear() + 1
			const initialPersonalExpDate = `04/10/${newYear}`
			await this.idExpirationInput.type(initialPersonalExpDate)
			await page.click('body')
			await this.saveContinueButton.nth(indexDocumentsSave).click()
			await page.waitForTimeout(1000)
			//Verify orig card data is saved
			expect(this.displayedPersonalExp).toContainText(`Exp: ${initialPersonalExpDate}`)
			await page.waitForTimeout(2000)
			// Edit Personal  ID info
			await this.editButtonGenericLocator.nth(indexDocumentsEdit).click()
			const updatedYear = newYear + 1
			const updatedPersonalExpDate = `10/25/${updatedYear}`
			await this.idExpirationInput.type(updatedPersonalExpDate)
			//TODO: Add steps for editing image files
			// Add here
			//
			// save
			await this.saveContinueButton.nth(indexDocumentsSave).click()
			await page.waitForTimeout(1500)
			//TODO: Verify that Personal info updated correctly
			expect(this.displayedPersonalExp).toContainText(`Exp: ${updatedPersonalExpDate}`)
		})

		await test.step('Payment Section', async () => {
			await this.paymentSection.waitFor({ state: 'visible' })
			await this.cashOption.click()
			const buttonIndexSave = isPickupVisible ? 2 : 3
			const buttonIndexEdit = isPickupVisible ? 2 : 4
			await this.saveContinueButton.nth(buttonIndexSave).click()
			await page.waitForTimeout(1500)
			expect(this.displayPayment).toHaveText('Cash')

			// Edit payment option if needed (example if there's a credit option)
			// await this.editButtonGenericLocator.nth(buttonIndexEdit).click()
			// await page.waitForTimeout(1500)
			// const paymentOptionIfPickUp = isPickupVisible ? 'debit' : 'aeropay'
			// const paymentOptionSelector = page.locator(`label[for="${paymentOptionIfPickUp}"]`)
			// await paymentOptionSelector.click()
			// await this.saveContinueButton.nth(buttonIndexSave).click()
			//await page.waitForTimeout(1500)
			// const expectedText = isPickupVisible ? 'Debit' : 'Aeropay'
			// expect(paymentOptionSelector).toHaveText(expectedText)
		})
	}
	//
	// newMedEnterInfoForCheckoutAndEdit currently used by both Live and Concierge MED tests
	async newMedEnterInfoForCheckoutAndEdit(page, siteEnv, addressParam, newAddressParam) {
		const isPickupVisible = await this.pickUpLocationTitle.isVisible()
		await test.step('Address for Delivery', async () => {
			if (!isPickupVisible) {
				//Verify that checkout page displays original address entered previously
				const originalAddress = addressParam
				await expect(this.displayedAddress).toContainText(originalAddress)
				await page.waitForTimeout(1000)
				// Edit delivery address
				await this.editButtonGenericLocator.first().waitFor({ state: 'visible' })
				await this.editButtonGenericLocator.first().click()
				await page.waitForTimeout(2000)
				//click the add new address button
				await this.addNewAddressButton.waitFor({ state: 'visible', timeout: 10000 }) // 30 seconds timeout
				await expect(this.addNewAddressButton).toBeVisible()
				await this.addNewAddressButton.click()
				// Type the address into the text field
				await this.addressField.waitFor({ state: 'visible', timeout: 10000 })
				await expect(this.addressField).toBeVisible()
				await this.addressField.click()
				const newAddress = newAddressParam
				await this.addressField.fill(newAddress)
				const dropDownSelector = page.locator('.pac-item')
				// Wait for the autocomplete suggestions to appear
				await this.page.waitForSelector('.pac-item') // Replace with the actual class or selector of the autocomplete suggestion items
				// Press 'ArrowDown' to navigate to the first suggestion and then press 'Enter' to select it
				// await this.addressField.press('ArrowDown')
				// await this.addressField.press('Enter')
				await dropDownSelector.first().click()
				await page.waitForTimeout(1000)
				//await this.checkoutPageTitle.click()
				await this.saveContinueButtonAddress.first().click()
				await page.waitForTimeout(1500)
				// Verify that Change delivery zones pops up
				// await expect(this.changeDeliveryPopUp).toBeVisible()
				// await expect(this.changeDeliveryPopUp).toContainText("You're changing delivery zones")
				// await expect(this.yesChangeAddressButton).toBeVisible()
				// await this.yesChangeAddressButton.click()
				//Verify that address was updated correctly
				const expectedNewTextDisplay = newAddressParam
				await expect(this.displayedAddress.first()).toContainText(expectedNewTextDisplay)
			}
		})
		await test.step('Delivery Appointment Section', async () => {
			const isPickupVisible = await this.pickUpLocationTitle.isVisible()
			if (!isPickupVisible) {
				await this.deliveryDayInputField.waitFor({ state: 'visible' })
				await this.deliveryDayInputField.selectOption({ index: 1 })
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				const initialDayValue = await this.deliveryDayInputField.inputValue()
				//const initialTimeValue = await this.deliveryTimeInputField.inputValue()
				// Retrieve the displayed text of the selected option
				const initialTimeValue = await page.locator('#time_type option:checked').innerText()
				console.log('Selected Text:', initialTimeValue)
				await this.saveContinueButton.first().click()
				const appointmentSummary = this.displayedAppointment
				const dateText = appointmentSummary.locator('p').nth(0)
				const timeText = appointmentSummary.locator('p').nth(1)
				const reformattedDateExpectedInitialDayValue = await this.reformatDateToLongFormat(
					initialDayValue,
				)
				await expect(dateText).toHaveText(reformattedDateExpectedInitialDayValue)
				await expect(timeText).toHaveText(initialTimeValue)

				// Edit and verify updated delivery day and time
				await this.editButtonGenericLocator.nth(1).click()
				await this.deliveryDayInputField.waitFor({ state: 'visible' })
				await this.deliveryDayInputField.selectOption({ index: 1 })
				await page.waitForTimeout(750)
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				await page.waitForTimeout(2000)
				const updatedDayValue = await this.deliveryDayInputField.inputValue()
				const updatedTimeValue = await page.locator('#time_type option:checked').innerText()
				await this.saveContinueButton.first().click()
				await page.waitForTimeout(2000)

				// erify appointment date/time
				const updatedReformattedDateExpectedUpdatedDayValue = await this.reformatDateToLongFormat(
					updatedDayValue,
				)
				await expect(dateText).toHaveText(updatedReformattedDateExpectedUpdatedDayValue)
				await expect(timeText).toHaveText(updatedTimeValue)
			}
		})
		await test.step('Phone and Birthday input', async () => {
			// Function to generate a random phone number
			const generatePhoneNumber = () => {
				const randomDigits = Math.floor(Math.random() * 9000000) + 1000000
				return `555-${randomDigits}`
			}
			// Enter initial phone number and birthday
			let phoneErrorExists = true
			let phoneNumber
			const firstDate = '01/01/1990'
			while (phoneErrorExists) {
				phoneNumber = generatePhoneNumber()
				await this.page.waitForTimeout(2000)
				await this.phoneInputField.waitFor({ state: 'visible' })
				await this.phoneInputField.fill(phoneNumber)
				await this.birthdayInputField.click()
				await this.birthdayInputField.type(firstDate)
				const initialPhoneNum = await this.phoneInputField.inputValue()
				const initialBirthday = await this.birthdayInputField.inputValue()
				await page.click('body')
				if (isPickupVisible) {
					await this.saveContinueButton.nth(0).click()
				} else {
					await this.saveContinueButton.nth(1).click()
				}
				await page.waitForTimeout(4000)
				phoneErrorExists = await page.isVisible('#fasd_phone_error:has-text("Already in use")')
				//Verify that phone & email display correctly (needs to be inside due to format)
				//reformat phone number to match
				const normalizedReceived = await this.normalizePhoneNumber(
					await this.displayedPhoneNumber.textContent(),
				)
				const normalizedExpected = await this.normalizePhoneNumber(initialPhoneNum)
				// Verify that displayed equals Initial values
				expect(normalizedReceived).toBe(normalizedExpected)
				expect(this.displayedBirthday).toHaveText(firstDate)
			}
			// Edit phone number and birthday
			if (isPickupVisible) {
				await this.editButtonGenericLocator.nth(0).click()
			} else {
				await this.editButtonGenericLocator.nth(2).click()
			}
			const newPhoneNumber = generatePhoneNumber()
			await this.phoneInputField.fill(newPhoneNumber)
			const newDate = '02/02/1992'
			await this.birthdayInputField.click()
			await this.birthdayInputField.type(newDate)
			// TODO: Edit First/Last name and Email
			const newFirstName = faker.name.firstName?.() || faker.person.firstName()
			const newLastName = faker.name.lastName?.() || faker.person.lastName()
			await this.firstNameField.fill(newFirstName)
			await this.lastNameField.fill(newLastName)
			// save edits
			if (isPickupVisible) {
				await this.saveContinueButton.nth(0).click()
			} else {
				await this.saveContinueButton.nth(1).click()
			}
			await page.waitForTimeout(2000)
			// TODO: ADD for newEmail
			//const newEmail =
			// TODO: Verify edits to First/Last, Email, Phone, and Birthday
			expect(this.displayedFirstName).toHaveText(newFirstName)
			// Fix for special characters like apostrophes in last names
			const displayedLastName = (await this.displayedLastName.textContent()) || ''
			expect(displayedLastName.replace(/\\/g, '')).toEqual(newLastName)
			//expect(this.displayedEmail).toHaveText(newEmail)
			const normalizedReceived2 = await this.normalizePhoneNumber(
				await this.displayedPhoneNumber.textContent(),
			)
			const normalizedExpected2 = await this.normalizePhoneNumber(newPhoneNumber)
			// Perform the assertion
			expect(normalizedReceived2).toBe(normalizedExpected2)
			//expect(this.displayedPhoneNumber).toHaveText(newPhoneNumber)
			expect(await this.displayedBirthday).toHaveText(newDate)
		})
		await test.step('Personal & Medical Document section', async () => {
			const dlUploadButton = await this.page.waitForSelector('#fasd_doc')
			const [driversLicenseChooser] = await Promise.all([
				this.page.waitForEvent('filechooser'),
				dlUploadButton.click(),
			])
			//Enter Personal ID info (Med already exists from pre-cart step)
			await driversLicenseChooser.setFiles('Medical-Card.png')
			await this.idExpirationInput.click()
			const newYear = new Date().getFullYear() + 1
			const initialPersonalExpDate = `04/10/${newYear}`
			await this.idExpirationInput.type(initialPersonalExpDate)
			const initialMedExpDate = await this.medExpirationInput.inputValue()
			// Reformat the retrieved date to match the "MM/DD/YYYY" format
			const initialMedExpDateReformatted = await this.reformatDate(initialMedExpDate)
			await page.click('body')
			// Edit phone number and birthday
			if (isPickupVisible) {
				await this.saveContinueButton.nth(1).click()
			} else {
				await this.saveContinueButton.nth(2).click()
			}
			await page.waitForTimeout(1000)
			//Verify orig card data is saved
			expect(this.displayedPersonalExp).toContainText(`Exp: ${initialPersonalExpDate}`)
			expect(this.displayedMedicalExp).toContainText(`Exp: ${initialMedExpDateReformatted}`)
			await page.waitForTimeout(2000)

			// Edit Personal & Medical ID info
			if (isPickupVisible) {
				await this.editButtonGenericLocator.nth(1).click()
			} else {
				await this.editButtonGenericLocator.nth(3).click()
			}
			const updatedYear = newYear + 1
			const updatedPersonalExpDate = `10/25/${updatedYear}`
			await this.idExpirationInput.type(updatedPersonalExpDate)
			const updatedMedExpDate = `09/09/${updatedYear}`
			await this.medExpirationInput.type('')
			await this.medExpirationInput.type(updatedMedExpDate)
			//TODO: Add steps for editing image files for both Pers and Med
			// Add here
			//
			// save
			if (isPickupVisible) {
				await this.saveContinueButton.nth(1).click()
			} else {
				await this.saveContinueButton.nth(2).click()
			}
			await page.waitForTimeout(1500)
			//TODO: Verify that Personal & MED info updated correctly
			expect(this.displayedPersonalExp).toContainText(`Exp: ${updatedPersonalExpDate}`)
			expect(this.displayedMedicalExp).toContainText(`Exp: ${updatedMedExpDate}`)
		})

		await test.step('Payment Section', async () => {
			const buttonIndexSave = isPickupVisible ? 2 : 3
			const buttonIndexEdit = isPickupVisible ? 2 : 4
			await this.paymentSection.waitFor({ state: 'visible' })
			// check if dev or stage to know payment options
			const paymentOptions = page.locator(
				'.fasd-input-group .wpse-checkout-radios input[type="radio"]',
			)
			// Get the count of payment options
			const optionsCount = await paymentOptions.count()
			console.log(`Number of payment options: ${optionsCount}`)
			if (optionsCount === 1) {
				console.log('Only one payment option is available. Just clicking cash option')
				await this.cashOption.click()
				await this.saveContinueButton.nth(buttonIndexSave).click()
				const paymentOptionSelector = page.locator(`label[for="cash"]`)
				expect(paymentOptionSelector).toHaveText('Cash')
			} else {
				console.log(`Unexpected number of payment options: ${optionsCount}`)
				// Handle unexpected cases if needed
				await this.cashOption.click()
				//
				await this.saveContinueButton.nth(buttonIndexSave).click()
				await page.waitForTimeout(1500)
				expect(this.displayPayment).toHaveText('Cash')

				// Edit payment option if needed (example if there's a credit option)
				await this.editButtonGenericLocator.nth(buttonIndexEdit).click()
				await page.waitForTimeout(1500)
				const paymentOptionIfPickUp = isPickupVisible ? 'debit' : 'aeropay'
				const paymentOptionSelector = page.locator(`label[for="${paymentOptionIfPickUp}"]`)
				await paymentOptionSelector.click()
				await this.saveContinueButton.nth(buttonIndexSave).click()
				await page.waitForTimeout(1500)
				const expectedText = isPickupVisible ? 'Debit' : 'Aeropay'
				expect(paymentOptionSelector).toHaveText(expectedText)
			}
		})
	}

	async recExistingCheckoutAndEdit(page, addressParam, newAddressParam) {
		const isPickupVisible = await this.pickUpLocationTitle.isVisible()
		await test.step('Address for Delivery', async () => {
			if (!isPickupVisible) {
				//Verify that checkout page displays original address entered previously
				await expect(this.displayedAddress).toHaveText(addressParam)
				await page.waitForTimeout(1000)
				// Edit delivery address
				await this.editButtonGenericLocator.first().waitFor({ state: 'visible' })
				await this.editButtonGenericLocator.first().click()
				await page.waitForTimeout(2000)
				//click the add new address button
				await this.addNewAddressButton.waitFor({ state: 'visible', timeout: 10000 }) // 30 seconds timeout
				await expect(this.addNewAddressButton).toBeVisible()
				await this.addNewAddressButton.click()
				// Type the address into the text field
				await this.addressField.waitFor({ state: 'visible', timeout: 10000 })
				await expect(this.addressField).toBeVisible()
				await this.addressField.click()
				const newAddress = newAddressParam
				await this.addressField.fill(newAddress)
				const dropDownSelector = page.locator('.pac-item')
				// Wait for the autocomplete suggestions to appear
				await this.page.waitForSelector('.pac-item') // Replace with the actual class or selector of the autocomplete suggestion items
				// Press 'ArrowDown' to navigate to the first suggestion and then press 'Enter' to select it
				// await this.addressField.press('ArrowDown')
				// await this.addressField.press('Enter')
				await dropDownSelector.first().click()
				await page.waitForTimeout(1000)
				//await this.checkoutPageTitle.click()
				await this.saveContinueButtonAddress.first().click()
				await page.waitForTimeout(1500)
				// Verify that Change delivery zones pops up
				await expect(this.changeDeliveryPopUp).toBeVisible()
				await expect(this.changeDeliveryPopUp).toContainText("You're changing delivery zones")
				await expect(this.yesChangeAddressButton).toBeVisible()
				await this.yesChangeAddressButton.click()
				//Verify that address was updated correctly
				const expectedNewTextDisplay = `2919 S La Cienega Blvd, Culver City, CA 90232`
				await expect(this.displayedAddress).toHaveText(expectedNewTextDisplay)
			}
		})
		await test.step('Delivery Appointment Section', async () => {
			if (!isPickupVisible) {
				await this.deliveryDayInputField.waitFor({ state: 'visible' })
				await this.deliveryDayInputField.selectOption({ index: 1 })
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				const initialDayValue = await this.deliveryDayInputField.inputValue()
				//const initialTimeValue = await this.deliveryTimeInputField.inputValue()
				// Retrieve the displayed text of the selected option
				const initialTimeValue = await page.locator('#time_type option:checked').innerText()
				console.log('Selected Text:', initialTimeValue)
				await this.saveContinueButton.nth(0).click()
				const appointmentSummary = this.displayedAppointment
				const dateText = appointmentSummary.locator('p').nth(0)
				const timeText = appointmentSummary.locator('p').nth(1)
				const reformattedDateExpectedInitialDayValue = await this.reformatDateToLongFormat(
					initialDayValue,
				)
				await expect(dateText).toHaveText(reformattedDateExpectedInitialDayValue)
				await expect(timeText).toHaveText(initialTimeValue)

				// Edit and verify updated delivery day and time
				await this.editButtonGenericLocator.nth(1).click()
				await this.deliveryDayInputField.waitFor({ state: 'visible' })
				await this.deliveryDayInputField.selectOption({ index: 1 })
				await page.waitForTimeout(750)
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				await page.waitForTimeout(2000)
				const updatedDayValue = await this.deliveryDayInputField.inputValue()
				const updatedTimeValue = await page.locator('#time_type option:checked').innerText()
				await this.saveContinueButton.nth(0).click()
				await page.waitForTimeout(2000)

				// erify appointment date/time
				const updatedReformattedDateExpectedUpdatedDayValue = await this.reformatDateToLongFormat(
					updatedDayValue,
				)
				await expect(dateText).toHaveText(updatedReformattedDateExpectedUpdatedDayValue)
				await expect(timeText).toHaveText(updatedTimeValue)
			}
		})
		await test.step('Phone and Birthday input', async () => {
			console.log('Editing phone and birthday')
			await this.editButtonGenericLocator.first().waitFor({ state: 'visible' })

			// Retry loop to ensure phone input field becomes visible
			let retryCount = 0
			const maxRetries = 5
			while (retryCount < maxRetries) {
				await this.editButtonGenericLocator.first().click({ force: true })
				await this.page.waitForTimeout(1000) // Small wait between attempts

				// Check if phone input field is visible
				const isPhoneFieldVisible = await this.phoneInputField.isVisible()
				if (isPhoneFieldVisible) {
					console.log(`Phone input field is visible after ${retryCount + 1} attempt(s)`)
					break
				}

				retryCount++
				console.log(`Phone input field not visible, retry ${retryCount}/${maxRetries}`)

				if (retryCount === maxRetries) {
					throw new Error(`Phone input field did not become visible after ${maxRetries} attempts`)
				}
			}

			await this.phoneInputField.waitFor({ state: 'visible' })
			console.log('After clicking edit button')
			const indexPersonalInfoSave = isPickupVisible ? 0 : 1
			const indexPersonalInfoEdit = isPickupVisible ? 0 : 2
			// Function to generate a random phone number
			const generatePhoneNumber = () => {
				const randomDigits = Math.floor(Math.random() * 9000000) + 1000000
				return `555-${randomDigits}`
			}
			// Enter initial phone number and birthday
			let phoneErrorExists = true
			let phoneNumber
			const firstDate = '01/01/1990'
			while (phoneErrorExists) {
				phoneNumber = generatePhoneNumber()
				await this.phoneInputField.waitFor({ state: 'visible' })
				await this.phoneInputField.fill(phoneNumber)
				await this.birthdayInputField.click()
				await this.birthdayInputField.type(firstDate)
				const initialPhoneNum = await this.phoneInputField.inputValue()
				const initialBirthday = await this.birthdayInputField.inputValue()
				await this.page.click('body')
				await this.page.waitForTimeout(1000)
				await this.saveContinueButton.nth(indexPersonalInfoSave).click()
				await this.page.waitForTimeout(4000)
				phoneErrorExists = await page.isVisible('#fasd_phone_error:has-text("Already in use")')
				//Verify that phone & email display correctly (needs to be inside due to format)
				//reformat phone number to match
				const normalizedReceived = await this.normalizePhoneNumber(
					await this.displayedPhoneNumber.textContent(),
				)
				const normalizedExpected = await this.normalizePhoneNumber(initialPhoneNum)
				// Verify that displayed equals Initial values
				expect(normalizedReceived).toBe(normalizedExpected)
				expect(this.displayedBirthday).toHaveText(firstDate)
			}
			// Edit phone number and birthday
			await this.editButtonGenericLocator.nth(indexPersonalInfoEdit).click()
			const newPhoneNumber = generatePhoneNumber()
			await this.phoneInputField.fill(newPhoneNumber)
			const newDate = '02/02/1992'
			await this.birthdayInputField.click()
			await this.birthdayInputField.type(newDate)
			// TODO: Edit First/Last name and Email
			const newFirstName = faker.name.firstName?.() || faker.person.firstName()
			const newLastName = faker.name.lastName?.() || faker.person.lastName()
			await this.firstNameField.fill(newFirstName)
			await this.lastNameField.fill(newLastName)
			// save edits
			await this.saveContinueButton.nth(indexPersonalInfoSave).click({ force: true })
			await page.waitForTimeout(2000)
			// TODO: ADD for newEmail
			//const newEmail =
			// TODO: Verify edits to First/Last, Email, Phone, and Birthday
			expect(this.displayedFirstName).toHaveText(newFirstName)
			// Fix for special characters like apostrophes in last names
			const displayedLastName = (await this.displayedLastName.textContent()) || ''
			expect(displayedLastName.replace(/\\/g, '')).toEqual(newLastName)
			//expect(this.displayedEmail).toHaveText(newEmail)
			const normalizedReceived2 = await this.normalizePhoneNumber(
				await this.displayedPhoneNumber.textContent(),
			)
			const normalizedExpected2 = await this.normalizePhoneNumber(newPhoneNumber)
			// Perform the assertion
			expect(normalizedReceived2).toBe(normalizedExpected2)
			//expect(this.displayedPhoneNumber).toHaveText(newPhoneNumber)
			expect(await this.displayedBirthday).toHaveText(newDate)
		})
		await test.step('Personal Document section', async () => {
			const indexDocumentsSave = isPickupVisible ? 1 : 2
			const indexDocumentsEdit = isPickupVisible ? 1 : 3
			const dlUploadButton = await this.page.waitForSelector('#fasd_doc')
			const [driversLicenseChooser] = await Promise.all([
				this.page.waitForEvent('filechooser'),
				dlUploadButton.click(),
			])
			//Enter Personal ID info (Med already exists from pre-cart step)
			await driversLicenseChooser.setFiles('Medical-Card.png')
			await this.idExpirationInput.click()
			const newYear = new Date().getFullYear() + 1
			const initialPersonalExpDate = `04/10/${newYear}`
			await this.idExpirationInput.type(initialPersonalExpDate)
			await page.click('body')
			await this.saveContinueButton.nth(indexDocumentsSave).click()
			await page.waitForTimeout(1000)
			//Verify orig card data is saved
			expect(this.displayedPersonalExp).toContainText(`Exp: ${initialPersonalExpDate}`)
			await page.waitForTimeout(2000)
			// Edit Personal  ID info
			await this.editButtonGenericLocator.nth(indexDocumentsEdit).click()
			const updatedYear = newYear + 1
			const updatedPersonalExpDate = `10/25/${updatedYear}`
			await this.idExpirationInput.type(updatedPersonalExpDate)
			//TODO: Add steps for editing image files
			// Add here
			//
			// save
			await this.saveContinueButton.nth(indexDocumentsSave).click()
			await page.waitForTimeout(1500)
			//TODO: Verify that Personal info updated correctly
			expect(this.displayedPersonalExp).toContainText(`Exp: ${updatedPersonalExpDate}`)
		})

		await test.step('Payment Section', async () => {
			await this.paymentSection.waitFor({ state: 'visible' })
			await this.cashOption.click()
			const buttonIndexSave = isPickupVisible ? 2 : 3
			const buttonIndexEdit = isPickupVisible ? 2 : 4
			await this.saveContinueButton.nth(buttonIndexSave).click()
			await page.waitForTimeout(1500)
			expect(this.displayPayment).toHaveText('Cash')

			// Edit payment option if needed (example if there's a credit option)
			// await this.editButtonGenericLocator.nth(buttonIndexEdit).click()
			// await page.waitForTimeout(1500)
			// const paymentOptionIfPickUp = isPickupVisible ? 'debit' : 'aeropay'
			// const paymentOptionSelector = page.locator(`label[for="${paymentOptionIfPickUp}"]`)
			// await paymentOptionSelector.click()
			// await this.saveContinueButton.nth(buttonIndexSave).click()
			//await page.waitForTimeout(1500)
			// const expectedText = isPickupVisible ? 'Debit' : 'Aeropay'
			// expect(paymentOptionSelector).toHaveText(expectedText)
		})
	}

	async verifyCheckoutPageLoads(page) {
		await test.step('Verify the Checkout titleloads correctly', async () => {
			// verify that checkout page title loads
			await this.checkoutPageTitle.waitFor({ state: 'visible' })
			await this.yourInfoSection.waitFor({ state: 'visible' })
		})
	}
	async enterPhoneNumber(page) {
		let phoneNumber = '555-555-5555'
		const maxAttempts = 5 // Maximum number of attempts
		let attempt = 0
		while (attempt < maxAttempts) {
			// Fill in the phone number
			await this.phoneInputField.fill(phoneNumber)
			// Wait for the phone input field to lose focus and trigger validation
			await page.click('body') // Click on the body to trigger validation
			// Check if the error message appears
			const isErrorVisible = await page.isVisible('#fasd_phone_error:has-text("Already in use")')
			if (isErrorVisible) {
				console.log(`Phone number ${phoneNumber} is already in use. Trying a new number...`)
				// Generate a new phone number (this is a simple example; you may want to implement a more sophisticated logic)
				const randomSuffix = Math.floor(1000 + Math.random() * 9000) // Generate a random 4-digit number
				phoneNumber = `555-555-${randomSuffix}`
				attempt++
			} else {
				console.log(`Phone number ${phoneNumber} accepted.`)
				break // Exit the loop if no error is found
			}
		}
		if (attempt === maxAttempts) {
			throw new Error('Failed to enter a unique phone number after multiple attempts.')
		}
	}

	async normalizePhoneNumber(phone) {
		// Remove all non-numeric characters first
		const digitsOnly = phone.replace(/\D/g, '')
		// Reformat to XXX-XXX-XXXX
		return digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
	}
	async reformatDate(dateStr) {
		const [year, month, day] = dateStr.split('-')
		return `${month}/${day}/${year}`
	}
	// Function to reformat the date to "Day Month Date" format
	async reformatDateToLongFormat(dateStr) {
		// Split the date string into year, month, and day components
		const [year, month, day] = dateStr.split('-').map(Number)

		// Create a new date using local time
		const date = new Date(year, month - 1, day) // Note: month is 0-indexed in JavaScript

		const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
		const monthName = date.toLocaleDateString('en-US', { month: 'long' })
		const dateNum = date.getDate()

		// Adding suffix for day (1st, 2nd, 3rd, etc.)
		const suffix =
			dateNum % 10 === 1 && dateNum !== 11
				? 'st'
				: dateNum % 10 === 2 && dateNum !== 12
				? 'nd'
				: dateNum % 10 === 3 && dateNum !== 13
				? 'rd'
				: 'th'

		return `${dayName} ${monthName} ${dateNum}${suffix}`
	}
	async placeOrder(page) {
		await test.step('Order Review & Password Section', async () => {
			await this.orderReviewSection.waitFor({ state: 'visible' })
			await this.passwordCheckoutField.waitFor({ state: 'visible' })
			await this.submitPasswordButton.waitFor({ state: 'visible' })
			//enter false password to verify enforcement
			await this.passwordCheckoutField.click()
			await this.passwordCheckoutField.fill('wrongpassword')
			await page.waitForTimeout(1500)
			await this.submitPasswordButton.click()
			await page.waitForTimeout(1500)
			await expect(this.passwordError).toHaveText('Please verify password')
			await page.waitForTimeout(1500)
			//enter correct password
			await this.passwordCheckoutField.click()
			const password = process.env.CHECKOUT_PASSWORD || ''
			await this.passwordCheckoutField.fill(password)
			await page.waitForTimeout(1500)
			await this.submitPasswordButton.click()
			await page.waitForTimeout(1500)
			// place order once password has been entered
			await this.placeOrderButton.waitFor({ state: 'visible' })
			await this.placeOrderButton.click()
		})
	}
}
module.exports = { CheckoutPage }
