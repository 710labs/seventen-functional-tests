import fs from 'fs/promises'
import path from 'path'
import { expect, test } from '@playwright/test'
import { AdminLogin } from '../../models/admin/admin-login-page'

const authFile = path.join(__dirname, '../../.auth/admin-drop.json')

test('Authenticate wp-admin for admin-drop smoke', async ({ page }) => {
	expect(process.env.ADMIN_USER, 'ADMIN_USER must be set').toBeTruthy()
	expect(process.env.ADMIN_PW, 'ADMIN_PW must be set').toBeTruthy()

	await fs.mkdir(path.dirname(authFile), { recursive: true })
	const adminLoginPage = new AdminLogin(page)
	await adminLoginPage.login()
	await expect(page.locator('#wp-admin-bar-my-account')).toBeVisible()
	await page.context().storageState({ path: authFile })
})
