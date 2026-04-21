import fs from 'fs/promises'
import { expect, test } from '@playwright/test'
import { OrderExportProfilePage } from '../../models/admin/order-export-profile-page'
import { getLastSevenDayRangeInTimeZone } from '../../utils/admin-drop/date-range'
import { parseOrderExport } from '../../utils/admin-drop/export-parser'

const expectedHeaders = [
	'Order Date',
	'Order ID',
	'Order Status',
	'Partner_Region_Slug',
	'Customer User Email',
	'Product Id',
	'Product Name',
	'Quantity',
	'Scheduling Type',
	'Order Line Total (include tax)',
	'Order Total Amount',
]

test('Order Export download and validation', async ({ page }, testInfo) => {
	const orderExportProfilePage = new OrderExportProfilePage(page)
	const { fromDate, toDate } = getLastSevenDayRangeInTimeZone('America/New_York')

	await orderExportProfilePage.goto()
	await orderExportProfilePage.setDateRange(fromDate, toDate)
	await orderExportProfilePage.saveSettings()

	await expect(page).toHaveURL(/profile_id=6/)
	await expect(orderExportProfilePage.fromDateInput).toHaveValue(fromDate)
	await expect(orderExportProfilePage.toDateInput).toHaveValue(toDate)
	await expect(orderExportProfilePage.exportButton).toBeVisible()

	const downloadPromise = page.waitForEvent('download')
	await orderExportProfilePage.clickExport()

	const download = await downloadPromise
	const suggestedFileName = download.suggestedFilename() || 'order-export.tsv'
	const downloadPath = testInfo.outputPath(suggestedFileName)

	await download.saveAs(downloadPath)
	await testInfo.attach('order-export-file', {
		path: downloadPath,
		contentType: 'text/plain',
	})

	const downloadStat = await fs.stat(downloadPath)
	expect(downloadStat.size).toBeGreaterThan(0)

	const parsedExport = await parseOrderExport(downloadPath)

	await testInfo.attach('order-export-header-row', {
		body: parsedExport.rawHeaderLine,
		contentType: 'text/plain',
	})
	await testInfo.attach('order-export-row-count', {
		body: String(parsedExport.rows.length),
		contentType: 'text/plain',
	})

	for (const header of expectedHeaders) {
		expect(
			parsedExport.headers.includes(header),
			`Expected export header "${header}" to exist. Raw header row: ${parsedExport.rawHeaderLine}`,
		).toBeTruthy()
	}

	expect(parsedExport.rows.length, 'Expected order export to contain at least one data row').toBeGreaterThan(0)

	const firstRow = parsedExport.rows[0]
	expect(firstRow['Order ID'], 'First export row is missing Order ID').toBeTruthy()
	expect(firstRow['Product Name'], 'First export row is missing Product Name').toBeTruthy()
	expect(firstRow['Order Total Amount'], 'First export row is missing Order Total Amount').toBeTruthy()
})
