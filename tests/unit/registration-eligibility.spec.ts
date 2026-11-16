import { expect, test } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { AgeGatePage } from '../../models/age-gate-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { isRegistrationEligibilityVisible } from '../../support/qa/registration-eligibility.cjs'

test.use({ baseURL: 'https://registration.example' })

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

	expect(await isRegistrationEligibilityVisible(page)).toBe(false)
})

test('requires the registration button as well as eligibility fields', async ({ page }) => {
	await page.setContent('<label>ID Upload <input name="svntn_core_personal_doc" type="file"></label>')
	expect(await isRegistrationEligibilityVisible(page)).toBe(false)
	await page.setContent('<button>Register</button>')
	expect(await isRegistrationEligibilityVisible(page)).toBe(false)
})

test('waits for the medical upload widget to accept the selected file', async ({ page }, info) => {
	const syntheticCard = info.outputPath('synthetic-medical-card.txt')
	writeFileSync(syntheticCard, 'Synthetic upload test fixture')
	await page.setContent(`
		<div class="eligibilityInput">
			<input name="svntn_core_medical_doc" type="file">
			<span class="unsealSuccess" hidden>On file</span>
		</div>
		<script>
			const input = document.querySelector('input')
			input.addEventListener('click', () => setTimeout(() => {
				input.addEventListener('change', () => {
					if (input.files[0]?.name === 'synthetic-medical-card.txt') document.querySelector('.unsealSuccess').hidden = false
				})
			}, 100))
		</script>
	`)
	await new CreateAccountPage(page)['uploadMedicalCard'](syntheticCard)
	await expect(page.getByText('On file')).toBeVisible()
})

test('uses direct registration when the storefront redirects to its unprotected sign-in page', async ({ page }) => {
	await page.route('https://registration.example/', route => route.fulfill({
		contentType: 'text/html',
		body: '<a href="/register/">Create an account</a><script>history.replaceState(null, "", "/my-account/")</script>',
	}))
	const ageGate = new AgeGatePage(page)
	expect(await ageGate.passAgeGate({ allowDirectRegistration: true })).toBe(false)
	await expect(page).toHaveURL('https://registration.example/my-account/')
})
