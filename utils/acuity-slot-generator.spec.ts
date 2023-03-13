import { Page, test } from '@playwright/test'
const csvFilePath = 'utils/delivery-slots.csv'
let csvToJson = require('convert-csv-to-json')
const { Parser } = require('json2csv')

test.describe('Acuity Automation', () => {
	let slots = csvToJson.fieldDelimiter(';').getJsonFromCsv(csvFilePath)
	test.describe.configure({ mode: 'parallel' })
	let page: Page
	test.beforeAll(async ({ browser }) => {
		//remove existing test failures csv
		//add new one with expected values
		page = await browser.newPage()
		await test.step('Login to Acuity Scheduling', async () => {
			await page.goto('https://login.squarespace.com/')
			await page.locator('[placeholder="name\\@example\\.com"]').fill(`${process.env.ACUITY_USER}`)
			await page.locator('[placeholder="Password"]').fill(`${process.env.ACUITY_PASSWORD}`)
			await Promise.all([
				page.waitForNavigation(),
				page.locator('[data-test="login-button"]').click(),
			])
		})
	})
	test.afterEach(async ({ page }, testInfo) => {
		if (testInfo.status !== testInfo.expectedStatus) {
			//Parse test title and add entry to failures.csv
			console.log(testInfo.title)
		}
	})

	for (let index = 0; index < slots.length; index++) {
		test(`Add Acuity Slots: ${slots[index].Partner_region_zone} - ${slots[index].DateOffered} - ${slots[index].TimeOffered} [${slots[index].Partner},${slots[index].Partner_region_zone},${slots[index].AppointmentID},${slots[index].URL},${slots[index].CalendarName},${slots[index].DateOffered},${slots[index].TimeOffered},${slots[index].LinkText},${slots[index].Availability}] @helper`, async ({}, workerInfo) => {
			test.skip(workerInfo.project.name === 'Mobile Chrome')
			await test.step(`Create Slot on ${slots[index].DateOffered} - ${slots[index].TimeOffered}`, async () => {
				//Navigate to Zone
				await page.goto(slots[index].URL)
				await page.waitForTimeout(10000)
				await page.goto(slots[index].URL)

				const popUp = await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.getByRole('button', { name: 'Close' })

				if (popUp != null) {
					popUp.click()
				}
				// Start Create Slot
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('#offer-class-btn')
					.first()
					.click()
				// Select "Another Test Calendar"
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('select[name="calendar"]')
					.selectOption({ label: slots[index].CalendarName })
				// Date Selector
				// Select Day of Month
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('#date-input')
					.fill(`${slots[index].DateOffered}`)

				// Select Time
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('[placeholder="Ex\\. 9\\:00am"]')
					.click()
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.locator('[placeholder="Ex\\. 9\\:00am"]')
					.fill(`${slots[index].TimeOffered}`)
				// Save Class
				await Promise.all([
					page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
					page.frameLocator('[data-test="scheduling-iframe"]').locator('text=Save Class').click(),
				])

				//Edit Capacity
				//Select Slot
				//Prevent 12PM and 2PM collison
				await page
					.frameLocator('[data-test="scheduling-iframe"]')
					.getByText(`${slots[index].LinkText}`, { exact: true })
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
					.fill(slots[index].Availability)

				// Save Slot
				await Promise.all([
					page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
					page.frameLocator('[data-test="scheduling-iframe"]').locator('text=Save Changes').click(),
				])
			})
		})
	}
})

// //Partner;Partner_region_zone;Appointment ID;URL;Calendar Name;Date Offered;Time Offered;Link Text;Availability
// const fields = [
// 	'Partner',
// 	'Partner_region_zone',
// 	'Appointment ID',
// 	'URL',
// 	'Calendar Name',
// 	'Date Offered',
// 	'Link Text',
// 	'Availability',
// ]
// const opts = { fields }
// const parser = new Parser(opts)
// const csv = parser.parse(slots[index])