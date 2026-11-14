import { randomUUID } from 'node:crypto'
import { expect, test } from '../../options'
import { AgeGatePage } from '../../models/age-gate-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'
import { selectAutocompleteAddress } from '../../support/qa/address-autocomplete'

const sanFrancisco = {
	street: '33 29th St',
	city: 'San Francisco',
	facility: 'Amuse San Francisco',
}
const facilityAddresses = [
	{ street: '735 S Broadway', city: 'Los Angeles', facility: 'Amuse Downtown LA' },
	sanFrancisco,
	{ street: '2943 Daylight Way', city: 'San Jose', facility: 'Amuse San Jose' },
]

test(
	'CA Stage selects the nearest pickup facility after each address edit',
	{ tag: ['@CA', '@recreational'] },
	async ({ page, baseURL }) => {
		test.skip(
			!baseURL || new URL(baseURL).hostname !== 'thelist-stage.710labs.com',
			'The Amuse facility fixtures are specific to CA stage.',
		)

		await new AgeGatePage(page).passAgeGate()
		await new ListPasswordPage(page).submitPassword(process.env.CHECKOUT_PASSWORD || '')
		await new CreateAccountPage(page).create(
			'Facility',
			'Test',
			`test+${randomUUID()}@710labs-test.com`,
			'test1234',
			'94110',
			'recreational',
			false,
			`${sanFrancisco.street}, ${sanFrancisco.city}, CA`,
			'CA',
		)

		const modal = page.locator('#fulfillmentElement')
		const pickup = modal.getByRole('radio', { name: 'Pickup', exact: true })
		const changeAddress = modal.getByRole('link', { name: 'Change', exact: true })
		const addressInput = page.locator('#mod_billing_address_1_place')
		const addressEditor = page.getByRole('heading', { name: 'Enter your address', exact: true })
		const submitAddress = page.getByRole('button', { name: 'Submit', exact: true })

		await expect(modal.getByRole('heading', { name: sanFrancisco.facility, exact: true }))
			.toBeVisible({ timeout: 15000 })

		for (const { street, city, facility } of facilityAddresses) {
			const address = `${street}, ${city}, CA`
			await test.step(`Change address to ${address} and verify ${facility}`, async () => {
				await changeAddress.click()
				await expect(addressEditor).toBeVisible()
				await selectAutocompleteAddress(page, addressInput, address)
				await expect(page.locator('#mod_billing_city')).toHaveValue(city)
				await submitAddress.click()

				await expect(addressEditor).toBeHidden({ timeout: 15000 })
				await expect(modal.locator('.wcse-reactive--origin'), 'The modal should show the saved address')
					.toContainText(address, { timeout: 15000 })
				await expect(pickup).toBeChecked()
				await expect(
					modal.getByRole('heading', { name: facility, exact: true }),
					`Expected ${facility} to be the pickup facility for ${address}`,
				).toBeVisible({ timeout: 15000 })
			})
		}
	},
)
