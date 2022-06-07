import { test, request } from '@playwright/test'
import { AdminLogin } from '../models/admin-login-page'

test.describe('Acuity Helpers', () => {
	var dates

	test.beforeAll(async ({ page, browserName }, workerInfo) => {
		test.skip(workerInfo.project.name === 'mobile-chrome')
		const apiContext = await request.newContext({
			baseURL: `${process.env.BASE_URL}${process.env.QA_ENDPOINT}`,
			extraHTTPHeaders: {
				'x-api-key': `${process.env.API_KEY}`,
			},
		})
		//Create Date Range for time slots to create.
	})
	test(`Add CA Acuity Slots @helper`, async ({ page, browserName }, workerInfo) => {
		const adminLoginPage = new AdminLogin(page)
		await test.step('Login Admin', async () => {
			adminLoginPage.login()
		})
		await test.step('Navigate to Delivery Dashboard', async () => {
			// Click #toplevel_page_svntn-core div:has-text("710 Labs Core")
			await Promise.all([
				page.waitForNavigation(/*{ url: 'https://thelist-dev.710labs.com/wp-admin/admin.php?page=svntn-core' }*/),
				page.locator('#toplevel_page_svntn-core div:has-text("710 Labs Core")').click(),
			])
			// Click text=Delivery Dashboard
			await Promise.all([
				page.waitForNavigation(/*{ url: 'https://thelist-dev.710labs.com/wp-admin/admin.php?page=svntn-delivery-dashboard' }*/),
				page.locator('text=Delivery Dashboard').click(),
			])
		})
		await test.step('Navigate to Acuity Scheduling', async () => {})
		await test.step('Login to Acuity Scheduling', async () => {
			// Click [placeholder="name\@example\.com"]
			await page.locator('[placeholder="name\\@example\\.com"]').click()
			// Fill [placeholder="name\@example\.com"]
			await page.locator('[placeholder="name\\@example\\.com"]').fill(`${process.env.ACUITY_USER}`)
			// Click [placeholder="Password"]
			await page.locator('[placeholder="Password"]').click()
			// Fill [placeholder="Password"]
			await page.locator('[placeholder="Password"]').fill(`${process.env.ACUITY_PASSWORD}`)
			// Click [data-test="login-button"]
			await Promise.all([
				page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
				page.locator('[data-test="login-button"]').click(),
			])
		})
		for (let index = 0; index < dates.length; index++) {
			await test.step(`Create Slot on ${dates[index]}`, async () => {
				//Navigate to 90210 Zone
				await page.goto(
					'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714',
				)
				// Start Create Slot
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('text=Offer Class')
					.click()
				// Select "Another Test Calendar"
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('select[name="calendar"]')
					.selectOption('6156957')
				// Date Selector
				await page.frameLocator('[data-test="scheduling-iframe"]').locator('#date-input').click()
				// Select Day of Month
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('div[role="button"]:has-text("13")')
					.click()
				// Select Time
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('[placeholder="Ex\\. 9\\:00am"]')
					.click()
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('[placeholder="Ex\\. 9\\:00am"]')
					.fill('9AM')
				// Save Class
				await Promise.all([
					page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
					page.frameLocator('[data-test="scheduling-iframe"]').locator('text=Save Class').click(),
				])

				//Edit Capacity
				//Select Slot
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('text=9:00am PDT Monday, June 13, 2022')
					.click()

				// Click Edit
				await page.frameLocator('[data-test="scheduling-iframe"]').locator('text=Edit').click()

				// Edit Capacity Value
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('text=Max number of people for this class >> input[name="group_max"]')
					.click()
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('text=Max number of people for this class >> input[name="group_max"]')
					.fill('100')

				// Save Slot
				await Promise.all([
					page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
					page.frameLocator('[data-test="scheduling-iframe"]').locator('text=Save Changes').click(),
				])
			})
		}
	})
})
