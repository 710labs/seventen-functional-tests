import type { Browser, BrowserContextOptions } from '@playwright/test'
import { AdminLogin } from '../../models/admin/admin-login-page'
import { TaxSettingsPage, type StoreTaxConfiguration } from '../../models/admin/tax-settings-page'
const { assertBulkBaseUrl, assertBulkNavigationUrl } = require('./environment.cjs')

// Playwright workers are separate processes. Cache configuration, never an admin
// session, across scenarios in a worker. Customer cookies stay in their own context.
const configurations = new Map<string, Promise<StoreTaxConfiguration[]>>()

export function readStoreTaxConfiguration(browser: Browser, baseURL: string,
	storageState: BrowserContextOptions['storageState'], taxClass: 'standard' | 'medical-rate') {
	const origin = assertBulkBaseUrl(baseURL)
	const key = `${origin}:${taxClass}`
	if (!configurations.has(key)) {
		const pending = (async () => {
			if (!process.env.ADMIN_USER || !process.env.ADMIN_PW) throw new Error('ADMIN_USER and ADMIN_PW are required to read store tax configuration')
			// No video/trace recording for this isolated admin context.
			const context = await browser.newContext({ baseURL: origin, storageState })
			try {
				await context.route('**/*', async route => {
					const request = route.request()
					if (request.isNavigationRequest() && request.frame().parentFrame() === null) {
						try { assertBulkNavigationUrl(request.url(), origin) } catch { await route.abort('blockedbyclient'); return }
					}
					await route.continue()
				})
				const page = await context.newPage()
				await new AdminLogin(page).login({ privateCredentials: true })
				return await new TaxSettingsPage(page).readRates(taxClass)
			} finally { await context.close() }
		})()
		configurations.set(key, pending)
		pending.catch(() => configurations.delete(key))
	}
	return configurations.get(key)!
}
