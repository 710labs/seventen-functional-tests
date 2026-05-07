import { expect, Page, TestInfo } from '@playwright/test'
import { PrivateStoreSettingsPage } from '../../models/admin/private-store-settings-page'

export type FocusedRulesStorefrontPasswordStatus = {
	checkoutPassword: string
	checkoutPasswordAlreadyActive: boolean
	addedCheckoutPassword: boolean
	passwordCount: number
}

export async function ensureFocusedRulesCheckoutPassword(
	page: Page,
	testInfo?: TestInfo,
): Promise<FocusedRulesStorefrontPasswordStatus> {
	const checkoutPassword = process.env.CHECKOUT_PASSWORD
	expect(checkoutPassword, 'CHECKOUT_PASSWORD must be set for focused rules storefront unlock').toBeTruthy()

	const privateStoreSettingsPage = new PrivateStoreSettingsPage(page)
	await privateStoreSettingsPage.goto()
	const existingPrivateStorePasswords = await privateStoreSettingsPage.getPasswordValues()
	const checkoutPasswordAlreadyActive = existingPrivateStorePasswords.includes(`${checkoutPassword}`)
	let addedCheckoutPassword = false

	if (!checkoutPasswordAlreadyActive) {
		await privateStoreSettingsPage.addPassword(`${checkoutPassword}`)
		await privateStoreSettingsPage.saveChanges()
		await privateStoreSettingsPage.goto()
		expect(await privateStoreSettingsPage.hasPassword(`${checkoutPassword}`)).toBe(true)
		addedCheckoutPassword = true
	}

	const status = {
		checkoutPassword: `${checkoutPassword}`,
		checkoutPasswordAlreadyActive,
		addedCheckoutPassword,
		passwordCount: existingPrivateStorePasswords.length,
	}

	await testInfo?.attach('focused-rules-private-store-password-status', {
		body: JSON.stringify(
			{
				checkoutPasswordAlreadyActive,
				addedCheckoutPassword,
				passwordCount: existingPrivateStorePasswords.length,
				checkoutPasswordLength: `${checkoutPassword}`.length,
			},
			null,
			2,
		),
		contentType: 'application/json',
	})

	return status
}

export async function cleanupFocusedRulesCheckoutPassword(
	page: Page,
	status: FocusedRulesStorefrontPasswordStatus | undefined,
) {
	if (!status?.addedCheckoutPassword) {
		return
	}

	const privateStoreSettingsPage = new PrivateStoreSettingsPage(page)
	await privateStoreSettingsPage.goto()
	const removed = await privateStoreSettingsPage.removePassword(status.checkoutPassword)

	if (removed) {
		await privateStoreSettingsPage.goto()
		expect(await privateStoreSettingsPage.hasPassword(status.checkoutPassword)).toBe(false)
	}
}
