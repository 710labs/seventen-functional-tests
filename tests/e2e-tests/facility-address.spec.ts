import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { AgeGatePage } from '../../models/age-gate-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { selectAutocompleteAddress } from '../../support/qa/address-autocomplete'
import { facilityAddressScenarios } from './fixtures/facility-addresses'

const configuredEnvironment = process.env.ENV_ID?.replace(/^staging-/, 'stage-')

test.describe.configure({ retries: 0 })

for (const { environment, origin, state, registration, edits } of facilityAddressScenarios) {
	test(
		`${environment} selects the nearest pickup facility after each address edit`,
		{ tag: [`@${state}`, '@recreational'] },
		async ({ page, baseURL }) => {
			test.skip(
				!baseURL || new URL(baseURL).origin !== origin ||
					(configuredEnvironment ? configuredEnvironment !== environment : state !== 'CA'),
				`These facilities are configured for ${environment}.`,
			)

			await new AgeGatePage(page).passAgeGate()
			await new ListPasswordPage(page).submitPassword(process.env.CHECKOUT_PASSWORD || '')
			const registrationAddress = `${registration.street}, ${registration.city}, ${state} ${registration.zip}`
			const email = `test+${randomUUID()}@710labs-test.com`
			const account = new CreateAccountPage(page)
			if (state === 'MI') {
				await account.createMichiganCustomer(
					'Facility', 'Test', email, 'test1234', 16, 12, 1988, '5551234567',
					'recreational', registrationAddress, '1234567890', 'M123456789012',
				)
			} else {
				await account.create(
					'Facility', 'Test', email, 'test1234', registration.zip,
					'recreational', false, registrationAddress, state,
				)
			}

			const modal = page.locator('#fulfillmentElement')
			const pickup = modal.getByRole('radio', { name: 'Pickup', exact: true })
			const changeAddress = modal.getByRole('link', { name: 'Change', exact: true })
			const addressInput = page.locator('#mod_billing_address_1_place')
			const addressEditor = page.getByRole('heading', { name: 'Enter your address', exact: true })
			const submitAddress = page.getByRole('button', { name: 'Submit', exact: true })

			await expect(changeAddress).toBeVisible({ timeout: 15000 })

			for (const { street, city, facility } of edits) {
				const address = `${street}, ${city}, ${state}`
				await test.step(`Change address to ${address} and verify ${facility}`, async () => {
					await changeAddress.click()
					await expect(addressEditor).toBeVisible()
					await selectAutocompleteAddress(page, addressInput, address)
					await expect(page.locator('#mod_billing_city')).toHaveValue(city)
					await submitAddress.click()

					await expect(addressEditor).toBeHidden({ timeout: 15000 })
					await expect(modal.locator('.wcse-reactive--origin'), 'The modal should show the saved address')
						.toContainText(address, { timeout: 15000 })
					if (!(await pickup.isChecked())) {
						await modal.getByText('Pickup', { exact: true }).click()
					}
					await expect(pickup).toBeChecked()
					await expect.soft(
						modal.getByRole('heading', { name: facility, exact: true }),
						`Expected ${facility} to be the pickup facility for ${address}`,
					).toBeVisible({ timeout: 15000 })
				})
			}
		},
	)
}
