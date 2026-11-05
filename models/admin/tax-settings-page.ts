import { expect, test, type Page } from '@playwright/test'

export type StoreTaxConfiguration = {
	country: string
	state: string
	label: string
	rate: string
	priority: number
	compound: boolean
}

export class TaxSettingsPage {
	constructor(private readonly page: Page) {}

	async readRates(taxClass: 'standard' | 'medical-rate'): Promise<StoreTaxConfiguration[]> {
		return test.step(`Read ${taxClass} tax configuration`, async () => {
			await this.page.goto(`/wp-admin/admin.php?page=wc-settings&tab=tax&section=${taxClass}`, { waitUntil: 'domcontentloaded' })
			await expect(this.page.locator('.wc_tax_rates')).toBeVisible()
			// WooCommerce supplies all rows to this table, including later UI pages.
			// Read only tax configuration; never retain the settings nonce or session.
			const rows = await this.page.evaluate(() => {
				const settings = (window as any).htmlSettingsTaxLocalizeScript
				if (!Array.isArray(settings?.rates)) throw new Error('WooCommerce tax table data is unavailable')
				return settings.rates.map(row => {
					if (!['0', '1'].includes(String(row.tax_rate_compound))) throw new Error('Invalid tax compound flag')
					return {
						country: row.tax_rate_country, state: row.tax_rate_state,
						label: row.tax_rate_name, rate: row.tax_rate,
						priority: Number(row.tax_rate_priority), compound: String(row.tax_rate_compound) === '1',
					}
				})
			})
			return rows
		})
	}
}
