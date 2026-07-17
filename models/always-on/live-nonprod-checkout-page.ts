import test, { expect, Locator, Page } from '@playwright/test'
import { CheckoutPage } from './checkout-page'

type SelectOption = {
	label: string
	value: string
}

export class LiveNonProdCheckoutPage extends CheckoutPage {
	async completeRecCheckout(page: Page, address: string, newAddress: string) {
		await this.completeCheckout(page, address, newAddress, false)
	}

	async completeMedCheckout(page: Page, address: string, newAddress: string) {
		await this.completeCheckout(page, address, newAddress, true)
	}

	private async completeCheckout(
		page: Page,
		address: string,
		newAddress: string,
		isMedical: boolean,
	) {
		const isPickup = await this.pickUpLocationTitle.isVisible().catch(() => false)

		await this.editDeliveryAddress(address, newAddress, isPickup)
		await this.selectAndVerifyAppointment(isPickup)
		await this.completePersonalInformation(page, isPickup)
		await this.completeDocuments(isPickup, isMedical)
		await this.completePayment(isPickup)
	}

	private async editDeliveryAddress(address: string, newAddress: string, isPickup: boolean) {
		await test.step('Verify and edit the Live delivery address', async () => {
			if (isPickup) {
				return
			}

			await expect(this.displayedAddress.first()).toContainText(address)
			await this.editButtonGenericLocator.first().click()
			await expect(this.addNewAddressButton).toBeVisible()
			await this.addNewAddressButton.click()
			await expect(this.addressField).toBeVisible()
			await this.addressField.fill(newAddress)
			const suggestion = this.page.locator('.pac-item').first()
			await expect(suggestion).toBeVisible()
			await suggestion.click()

			const city = this.page.locator('#fasd_city')
			const state = this.page.locator('#fasd_state')
			const postcode = this.page.locator('#fasd_postcode')
			await expect
				.poll(
					async () =>
						(await city.inputValue().catch(() => '')) &&
						(await state.inputValue().catch(() => '')) &&
						(await postcode.inputValue().catch(() => '')),
					{ timeout: 10000 },
				)
				.toBeTruthy()

			for (const input of [city, postcode]) {
				const value = await input.inputValue()
				await input.fill('')
				await input.fill(value)
				await input.dispatchEvent('change')
			}

			const stateValue = await state.inputValue()
			await state.selectOption(stateValue)
			await state.dispatchEvent('change')
			await postcode.press('Tab')
			await this.saveContinueButtonAddress.first().click()

			if (await this.yesChangeAddressButton.isVisible().catch(() => false)) {
				await this.yesChangeAddressButton.click()
			}

			await expect(this.displayedAddress.first()).toContainText(newAddress)
		})
	}

	private async getValidOptions(select: Locator): Promise<SelectOption[]> {
		return select.locator('option').evaluateAll(options =>
			options
				.map(option => ({
					label: (option.textContent || '').replace(/\s+/g, ' ').trim(),
					value: (option as HTMLOptionElement).value,
					disabled: (option as HTMLOptionElement).disabled,
				}))
				.filter(
					option =>
						!option.disabled &&
						Boolean(option.value) &&
						!/^select\b|choose\b/i.test(option.label),
				)
				.map(({ label, value }) => ({ label, value })),
		)
	}

	private async waitForValidOptions(select: Locator) {
		await expect
			.poll(async () => (await this.getValidOptions(select)).length, { timeout: 15000 })
			.toBeGreaterThan(0)
		return this.getValidOptions(select)
	}

	private async chooseAppointment(
		previousDayValue: string | null = null,
		previousTimeValue: string | null = null,
	) {
		await expect(this.deliveryDayInputField).toBeVisible()
		const dayOptions = await this.waitForValidOptions(this.deliveryDayInputField)
		const day = dayOptions.find(option => option.value !== previousDayValue) || dayOptions[0]
		await this.deliveryDayInputField.selectOption({ value: day.value })
		await expect(this.deliveryDayInputField).toHaveValue(day.value)
		await this.page.waitForTimeout(1000)

		let time: SelectOption | undefined

		for (let attempt = 1; attempt <= 4; attempt += 1) {
			const timeOptions = await this.waitForValidOptions(this.deliveryTimeInputField)
			time = timeOptions.find(option => option.value !== previousTimeValue) || timeOptions[0]
			await this.deliveryTimeInputField.selectOption({ value: time.value })
			await this.page.waitForTimeout(750)

			if ((await this.deliveryTimeInputField.inputValue()) === time.value) {
				break
			}

			time = undefined
			await this.page.waitForTimeout(500)
		}

		if (!time) {
			throw new Error(`The Live delivery time selection did not persist for day ${day.value}.`)
		}

		return { day, time }
	}

	private async expectAppointmentSummary(day: SelectOption, time: SelectOption) {
		const expectedDate = await this.reformatDateToLongFormat(day.value)

		await expect
			.poll(
				async () =>
					((await this.displayedAppointment.innerText().catch(() => '')) || '')
						.replace(/\s+/g, ' ')
						.trim(),
				{ timeout: 15000 },
			)
			.toContain(expectedDate)
		await expect(this.displayedAppointment).toContainText(time.label)
	}

	private async selectAndVerifyAppointment(isPickup: boolean) {
		await test.step('Select and persist a stable Live delivery appointment', async () => {
			if (isPickup) {
				return
			}

			const initialAppointment = await this.chooseAppointment()
			await this.saveContinueButton.nth(0).click()
			await this.expectAppointmentSummary(initialAppointment.day, initialAppointment.time)

			await this.editButtonGenericLocator.nth(1).click()
			const updatedAppointment = await this.chooseAppointment(
				initialAppointment.day.value,
				initialAppointment.time.value,
			)
			await this.saveContinueButton.nth(0).click()
			await this.expectAppointmentSummary(updatedAppointment.day, updatedAppointment.time)
		})
	}

	private generatePhoneNumber() {
		return `555-${Math.floor(1000000 + Math.random() * 9000000)}`
	}

	private async completePersonalInformation(page: Page, isPickup: boolean) {
		await test.step('Complete required Live personal information', async () => {
			const saveButtonIndex = isPickup ? 0 : 1
			const birthdayValue = '1990-01-01'
			const displayedBirthday = '01/01/1990'
			let acceptedPhone = ''

			for (let attempt = 1; attempt <= 5; attempt += 1) {
				acceptedPhone = this.generatePhoneNumber()
				await expect(this.phoneInputField).toBeVisible()
				await this.phoneInputField.fill(acceptedPhone)
				await this.birthdayInputField.fill(birthdayValue)
				await page.locator('body').click({ position: { x: 1, y: 1 } })
				await this.saveContinueButton.nth(saveButtonIndex).click()
				await page.waitForTimeout(1000)

				if (!(await page.locator('#fasd_phone_error').isVisible().catch(() => false))) {
					break
				}

				if (attempt === 5) {
					throw new Error('Unable to generate an unused phone number after five attempts.')
				}
			}

			await expect(this.displayedPhoneNumber).toBeVisible()
			const displayedPhone = await this.displayedPhoneNumber.textContent()
			expect(await this.normalizePhoneNumber(displayedPhone || '')).toBe(
				await this.normalizePhoneNumber(acceptedPhone),
			)
			await expect(this.displayedBirthday).toHaveText(displayedBirthday)
		})
	}

	private async completeDocuments(isPickup: boolean, isMedical: boolean) {
		await test.step('Complete required Live identity documents', async () => {
			const saveButtonIndex = isPickup ? 1 : 2
			const expirationYear = new Date().getFullYear() + 1
			const personalExpirationValue = `${expirationYear}-04-10`
			const displayedPersonalExpiration = `04/10/${expirationYear}`

			await this.page.locator('#fasd_doc').setInputFiles('CA-DL.jpg')
			await this.idExpirationInput.fill(personalExpirationValue)
			await this.page.locator('body').click({ position: { x: 1, y: 1 } })
			await this.saveContinueButton.nth(saveButtonIndex).click()
			await expect(this.displayedPersonalExp).toContainText(
				`Exp: ${displayedPersonalExpiration}`,
			)

			if (isMedical) {
				await expect(this.displayedMedicalExp).toContainText(/Exp:/)
			}
		})
	}

	private async completePayment(isPickup: boolean) {
		await test.step('Complete required Live payment information', async () => {
			const saveButtonIndex = isPickup ? 2 : 3
			await expect(this.paymentSection).toBeVisible()
			await this.cashOption.click()
			await this.saveContinueButton.nth(saveButtonIndex).click()
			await expect(this.displayPayment).toHaveText('Cash')
		})
	}
}
