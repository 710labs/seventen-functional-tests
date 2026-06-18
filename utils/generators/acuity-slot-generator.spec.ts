import { Locator, Page, test } from '@playwright/test'
const csvFilePath = process.env.ACUITY_SLOT_FILE || 'utils/delivery-slots.csv'
let csvToJson = require('convert-csv-to-json')
const { Parser } = require('json2csv')

const schedulingFrameSelector = '[data-test="scheduling"], [data-test="scheduling-iframe"]'

async function schedulingLocator(page: Page, selector: string): Promise<Locator> {
	if ((await page.locator(schedulingFrameSelector).count()) > 0) {
		return page.frameLocator(schedulingFrameSelector).locator(selector)
	}

	return page.locator(selector)
}

async function schedulingText(
	page: Page,
	text: string,
	options?: { exact?: boolean },
): Promise<Locator> {
	if ((await page.locator(schedulingFrameSelector).count()) > 0) {
		return page.frameLocator(schedulingFrameSelector).getByText(text, options)
	}

	return page.getByText(text, options)
}

test.describe('Acuity Automation', () => {
	let slots = csvToJson.fieldDelimiter(';').getJsonFromCsv(csvFilePath)
	let page: Page
	test.beforeAll(async ({ browser }) => {
		//remove existing test failures csv
		//add new one with expected values
		page = await browser.newPage()
		await test.step('Login to Acuity Scheduling', async () => {
			await page.goto('https://login.squarespace.com/')
			await page.waitForTimeout(1000)
			await page.locator('[placeholder="name\\@example\\.com"]').clear()
			await page.locator('[placeholder="name\\@example\\.com"]').fill(`${process.env.ACUITY_USER}`)
			await page.waitForTimeout(1000)
			await page.locator('[placeholder="Password"]').clear()
			await page.locator('[placeholder="Password"]').fill(`${process.env.ACUITY_PASSWORD}`)
			await page.waitForTimeout(1000)
			await Promise.all([page.locator('[data-test="login-button"]').click()])
			await page.waitForTimeout(45 * 1000)
		})
	})

	for (let index = 0; index < slots.length; index++) {
		test(`Add Acuity Slots: ${slots[index].Partner_region_zone};${slots[index].AppointmentID};${slots[index].URL};${slots[index].DateOffered};${slots[index].CalendarName};${slots[index].TimeOffered};${slots[index].LinkText};${slots[index].Availability} @helper`, async ({}, workerInfo) => {
			test.skip(workerInfo.project.name === 'Mobile Chrome')
			await test.step(`Create Slot on ${slots[index].DateOffered} - ${slots[index].TimeOffered}`, async () => {
				//Navigate to Zone
				await page.goto(slots[index].URL)
				await page.waitForTimeout(10000)
				await page.goto(slots[index].URL)

				// Start Create Slot
				const offerClassButton = await schedulingLocator(
					page,
					'#offer-class-btn, [data-testid="offer-class"]',
				)
				await offerClassButton.first().click()
				// Select "Another Test Calendar"
				const calendarSelect = await schedulingLocator(page, 'select[name="calendar"]')
				await calendarSelect.selectOption({ label: slots[index].CalendarName })
				// Date Selector
				// Select Day of Month
				const dateInput = await schedulingLocator(page, '#date-input')
				await dateInput.fill(`${slots[index].DateOffered}`)

				// Select Time
				const timeInput = await schedulingLocator(page, '[placeholder="Ex\\. 9\\:00am"]')
				await timeInput.click()
				await timeInput.fill(`${slots[index].TimeOffered}`)
				// Save Class
				const saveClassButton = await schedulingText(page, 'Save Class')
				await Promise.all([
					page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
					saveClassButton.click(),
				])

				//Edit Capacity
				//Select Slot
				//Prevent 12PM and 2PM collison
				const slotLink = await schedulingText(page, `${slots[index].LinkText}`, { exact: true })
				await slotLink.click()

				// Click Edit
				const editButton = await schedulingText(page, 'Edit')
				await editButton.click()

				// Edit Capacity Value
				const capacityInput = await schedulingLocator(
					page,
					'text=Max number of people for this class >> input[name="group_max"]',
				)
				await capacityInput.click()
				await capacityInput.fill(slots[index].Availability)

				// Save Slot
				const saveChangesButton = await schedulingText(page, 'Save Changes')
				await saveChangesButton.click()
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
