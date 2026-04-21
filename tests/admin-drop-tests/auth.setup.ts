import fs from 'fs/promises'
import path from 'path'
import { expect, test } from '@playwright/test'

const authFile = path.join(__dirname, '../../.auth/admin-drop.json')

test('Authenticate wp-admin for admin-drop smoke', async ({ page }) => {
	expect(process.env.ADMIN_USER, 'ADMIN_USER must be set').toBeTruthy()
	expect(process.env.ADMIN_PW, 'ADMIN_PW must be set').toBeTruthy()

	await fs.mkdir(path.dirname(authFile), { recursive: true })

	await page.goto('/wp-admin/')
	await expect(page.locator('input[name="log"]')).toBeVisible()
	await page.locator('input[name="log"]').fill(process.env.ADMIN_USER || '')
	await page.locator('input[name="pwd"]').fill(process.env.ADMIN_PW || '')

	await Promise.all([
		page.waitForNavigation({ waitUntil: 'networkidle' }),
		page.locator('input[name="wp-submit"]').click(),
	])

	await expect(page.locator('#wp-admin-bar-my-account')).toBeVisible()
	await page.context().storageState({ path: authFile })
})
