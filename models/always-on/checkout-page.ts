require('dotenv').config('.env')
import test, { expect, Locator, Page } from '@playwright/test'
const glob = require('glob')
const fs = require('fs')
const path = require('path')

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
	readonly deliveryAppointmentSection: Locator
	readonly deliveryDayInputField: Locator
	readonly deliveryTimeInputField: Locator
	readonly saveContinueButtonDelivery: Locator
	readonly paymentSection: Locator
	readonly cashOption: Locator
	readonly saveContinueButtonPayment: Locator
	readonly orderReviewSection: Locator
	readonly placeOrderButton: Locator
	readonly pickUpLocationTitle: Locator

	constructor(page: Page) {
		this.page = page
		this.checkoutPageTitle = page.locator('h2:has-text("Checkout")')
		this.yourInfoSection = page.locator('#checkout_info_step')
		this.phoneInputField = page.locator('#fasd_phone')
		this.birthdayInputField = page.locator('#fasd_dob')
		this.saveContinueButton = page.locator('a.wpse-button-primary.fasd-form-submit')
		this.saveContinueButtonInfoSection = page.locator('a.wpse-button-primary.fasd-form-submit')
		this.saveContinueButtonPersonalDocument = page.locator('a.wpse-button-primary.fasd-form-submit')
		this.documentsSection = page.locator('#checkout_id')
		this.idExpirationInput = page.locator('#doc_exp')
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
		this.saveContinueButtonPayment = page
			.locator('a.wpse-button-primary.fasd-form-submit[href="#0"]')
			.nth(2)
		this.orderReviewSection = page.locator('#checkout_checkout')
		this.placeOrderButton = page.locator("//button[@id='place_order']")
		this.pickUpLocationTitle = page.locator('h2:has-text("Pickup Location")')
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
	async enterInfoForCheckout(page) {
		await test.step('Phone and Birthday input', async () => {
			// Function to generate a random phone number
			const generatePhoneNumber = () => {
				const randomDigits = Math.floor(Math.random() * 9000000) + 1000000 // Generate a 7-digit random number
				return `555-${randomDigits}`
			}
			let phoneErrorExists = true
			while (phoneErrorExists) {
				const phoneNumber = generatePhoneNumber()
				// Verify that the phone input field is visible
				await this.phoneInputField.waitFor({ state: 'visible' })
				// Enter the phone number into the field
				await this.phoneInputField.fill(phoneNumber)
				// Enter the birthday
				await this.birthdayInputField.waitFor({ state: 'visible' })
				await this.birthdayInputField.click()
				await this.birthdayInputField.type('01/01/1990')
				// Click on the body to remove focus from the input fields
				await page.click('body')
				// Click the Save & Continue button
				await this.saveContinueButton.first().click()
				// Wait for a short period to see if the error message appears
				await page.waitForTimeout(1000) // Adjust timeout based on UI response time
				// Check if the error message is displayed
				phoneErrorExists = await page.isVisible('#fasd_phone_error:has-text("Already in use")')

				if (phoneErrorExists) {
					console.log(
						`Phone number ${phoneNumber} is already in use. Retrying with a new number...`,
					)
				} else {
					console.log(`Phone number ${phoneNumber} was successfully accepted.`)
				}
			}
		})
		await test.step('Personal Document section', async () => {
			const dlUploadButton = await this.page.waitForSelector('#fasd_doc')
			const [driversLicenseChooser] = await Promise.all([
				this.page.waitForEvent('filechooser'),
				dlUploadButton.click(),
			])
			await this.page.waitForTimeout(5000)
			await driversLicenseChooser.setFiles('Medical-Card.png')
			await this.idExpirationInput.click()
			const newYear = new Date().getFullYear() + 1
			await this.idExpirationInput.type(`01/01/${newYear}`)
			// Click on the body to remove focus from the input fields
			await page.click('body')
			await this.saveContinueButton.nth(1).click()
			await page.waitForTimeout(1000) // Adjust timeout based on UI response time
		})
		await test.step('Delivery Appointment Section', async () => {
			// Check if the "order is Delivery or Pickup in order to fill out or not
			const isPickupVisible = await this.pickUpLocationTitle.isVisible()
			// if its a delivery order, then do the following
			if (!isPickupVisible) {
				await this.deliveryDayInputField.waitFor({ state: 'visible' })
				await this.deliveryDayInputField.click()
				await this.deliveryDayInputField.selectOption({ index: 1 })
				await this.deliveryTimeInputField.waitFor({ state: 'visible' })
				await this.deliveryTimeInputField.click()
				await this.deliveryTimeInputField.selectOption({ index: 1 })
				await this.saveContinueButton.nth(2).click()
			}
		})
		await test.step('Payment Section', async () => {
			await this.paymentSection.waitFor({ state: 'visible' })
			await this.cashOption.click()
			const isPickupVisible = await this.pickUpLocationTitle.isVisible()
			if (!isPickupVisible) {
				await this.saveContinueButton.nth(3).click()
			} else {
				await this.saveContinueButton.nth(2).click()
			}
		})
		await test.step('Order Review Section', async () => {
			await this.orderReviewSection.waitFor({ state: 'visible' })
			await this.placeOrderButton.click()
		})
	}
}
module.exports = { CheckoutPage }
