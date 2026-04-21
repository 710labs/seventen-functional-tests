import { expect, test } from '@playwright/test'
import { PrivateStoreSettingsPage } from '../../models/admin/private-store-settings-page'
import { CAStorefrontGatePage } from '../../models/admin-drop/ca-storefront-gate-page'
import { ListPasswordPage } from '../../models/list-password-protect-page'

test('Private Store round trip', async ({ page, browser }) => {
	const basePassword = process.env.PRIVATE_STORE_TEST_PASSWORD
	const uniqueRunId = process.env.UNIQUE_RUN_ID || Date.now().toString()
	const privateStoreSettingsPage = new PrivateStoreSettingsPage(page)
	const cleanupErrors: string[] = []
	let storefrontContext
	let mainError: unknown

	expect(basePassword, 'PRIVATE_STORE_TEST_PASSWORD must be set').toBeTruthy()

	const generatedPassword = `${basePassword}-${uniqueRunId}`

	try {
		await privateStoreSettingsPage.goto()

		const existingPasswords = await privateStoreSettingsPage.getPasswordValues()
		expect(
			existingPasswords.includes(generatedPassword),
			`Generated private-store password "${generatedPassword}" already exists before the test starts`,
		).toBeFalsy()

		await privateStoreSettingsPage.addPassword(generatedPassword)
		await privateStoreSettingsPage.saveChanges()
		await privateStoreSettingsPage.goto()
		expect(await privateStoreSettingsPage.hasPassword(generatedPassword)).toBeTruthy()

		storefrontContext = await browser.newContext({
			baseURL: process.env.BASE_URL,
		})

		const storefrontPage = await storefrontContext.newPage()
		const storefrontGatePage = new CAStorefrontGatePage(storefrontPage)
		const listPasswordPage = new ListPasswordPage(storefrontPage)

		await storefrontGatePage.openHomeAndPassAgeGateIfPresent()
		await expect(storefrontPage.locator('input[name="post_password"]')).toBeVisible()

		await listPasswordPage.submitPassword('INCORRECT')
		await expect(storefrontPage.locator('input[name="post_password"]')).toBeVisible()
		await expect(storefrontPage).toHaveTitle(/Password/i)

		await listPasswordPage.submitPassword(generatedPassword)
		await expect(storefrontPage.locator('input[name="post_password"]')).toBeHidden()
		await expect(storefrontPage).not.toHaveTitle(/Password/i)
		await expect
			.poll(
				async () =>
					storefrontPage.url().includes('#usage') ||
					(await storefrontPage
						.getByRole('heading', { name: /complete your account/i })
						.isVisible()
						.catch(() => false)) ||
					(await storefrontPage.locator('input[name="svntn_last_usage_type"]').first().isVisible().catch(() => false)) ||
					/\/my-account\/?$/.test(new URL(storefrontPage.url()).pathname),
				{
					message:
						'Expected storefront to show a valid post-unlock page after submitting the correct private-store password',
				},
			)
			.toBe(true)

		await storefrontPage.goto('/shop/')
		await expect(storefrontPage.locator('ul.products li.product').first()).toBeVisible()
	} catch (error) {
		mainError = error
	} finally {
		try {
			await privateStoreSettingsPage.goto()
			const removed = await privateStoreSettingsPage.removePassword(generatedPassword)

			if (removed) {
				await privateStoreSettingsPage.goto()
				expect(await privateStoreSettingsPage.hasPassword(generatedPassword)).toBeFalsy()
			}
		} catch (cleanupError) {
			cleanupErrors.push(`${cleanupError}`)
		}

		if (storefrontContext) {
			await storefrontContext.close()
		}
	}

	expect(cleanupErrors, cleanupErrors.join('\n')).toEqual([])

	if (mainError) {
		throw mainError
	}
})
