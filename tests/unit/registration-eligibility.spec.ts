import { expect, test } from '@playwright/test'
import { CreateAccountPage } from '../../models/create-account-page'

const eligibilityPanel = `
	<section id="eligibilityContext">
		<label>ID Upload <input name="svntn_core_personal_doc" type="file"></label>
		<button disabled>Register</button>
	</section>
`
const submitSnapshot = {
	url: 'https://registration.example/register/',
	address: { exists: true, value: '440 N Rodeo Dr' },
	billingState: { exists: true, value: 'CA' },
	billingZip: { exists: true, value: '90210' },
	bodyPreview: 'Synthetic registration form',
}

test('waits for registration eligibility on the shop without navigating to account settings', async ({ page }) => {
	const requests: string[] = []
	await page.route('https://registration.example/**', async route => {
		requests.push(new URL(route.request().url()).pathname)
		await route.fulfill({
			contentType: 'text/html',
			body: `<main>Shop</main><script>
				setTimeout(() => { document.querySelector('main').innerHTML = ${JSON.stringify(eligibilityPanel)} }, 700)
			</script>`,
		})
	})
	await page.goto('https://registration.example/')
	const account = new CreateAccountPage(page)

	await account['waitForEligibilityStep']('CA', '90210', submitSnapshot)

	await expect(page).toHaveURL('https://registration.example/')
	await expect(page.getByRole('button', { name: 'Register', exact: true })).toBeVisible()
	expect(requests).toEqual(['/'])
})

test('reports missing registration eligibility at the shop without attempting account recovery', async ({ page }) => {
	const requests: string[] = []
	await page.route('https://registration.example/**', async route => {
		requests.push(new URL(route.request().url()).pathname)
		await route.fulfill({ contentType: 'text/html', body: '<main>Shop</main>' })
	})
	await page.goto('https://registration.example/')
	const account = new CreateAccountPage(page)

	await expect(account['waitForEligibilityStep']('CA', '90210', submitSnapshot))
		.rejects.toThrow('Registration eligibility/license controls did not appear within 20 seconds')

	expect(requests).toEqual(['/'])
	await expect(page).toHaveURL('https://registration.example/')
})

test('does not accept account eligibility fields as the registration step', async ({ page }) => {
	await page.route('https://registration.example/**', route => route.fulfill({
		contentType: 'text/html', body: eligibilityPanel,
	}))
	await page.goto('https://registration.example/my-account/eligibility/')

	expect(await new CreateAccountPage(page)['isEligibilityLicenseStepVisible']()).toBe(false)
})

test('requires the registration button as well as eligibility fields', async ({ page }) => {
	await page.setContent('<label>ID Upload <input name="svntn_core_personal_doc" type="file"></label>')
	expect(await new CreateAccountPage(page)['isEligibilityLicenseStepVisible']()).toBe(false)
	await page.setContent('<button>Register</button>')
	expect(await new CreateAccountPage(page)['isEligibilityLicenseStepVisible']()).toBe(false)
})
