import { Locator, Page, test } from '@playwright/test'
const csvFilePath = process.env.ACUITY_SLOT_FILE || 'utils/delivery-slots.csv'
let csvToJson = require('convert-csv-to-json')
const { Parser } = require('json2csv')

const schedulingFrameSelector = '[data-test="scheduling"], [data-test="scheduling-iframe"]'
const offerClassButtonSelector = '#offer-class-btn, [data-testid="offer-class"]'

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

function requireEnv(name: string): string {
	const value = process.env[name]
	if (!value) {
		throw new Error(`${name} is required to run the Acuity upload helper.`)
	}

	return value
}

function isSquarespaceLoginUrl(url: string): boolean {
	const normalizedUrl = url.toLowerCase()
	return (
		normalizedUrl.includes('login.squarespace.com') ||
		(normalizedUrl.includes('squarespace.com') && normalizedUrl.includes('/login'))
	)
}

function isAuthChallengeUrl(url: string): boolean {
	const normalizedUrl = url.toLowerCase()
	return [
		'captcha',
		'challenge',
		'mfa',
		'security-check',
		'two-factor',
		'verification',
	].some((fragment) => normalizedUrl.includes(fragment))
}

async function failWithPageContext(
	page: Page,
	message: string,
	cause?: unknown,
): Promise<never> {
	const title = await page.title().catch(() => 'unavailable')
	const causeMessage = cause instanceof Error ? ` ${cause.message}` : ''
	throw new Error(`${message} Current URL: ${page.url()}. Page title: ${title}.${causeMessage}`)
}

async function loginPageMessage(page: Page): Promise<string | null> {
	if (!isSquarespaceLoginUrl(page.url())) {
		return null
	}

	const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '')
	const normalizedText = bodyText.replace(/\s+/g, ' ').trim()
	if (!normalizedText) {
		return null
	}

	const hasLoginProblem = [
		'captcha',
		'incorrect',
		'invalid',
		'try again',
		'two-factor',
		'unable to log in',
		'verification',
	].some((fragment) => normalizedText.toLowerCase().includes(fragment))

	return hasLoginProblem ? normalizedText.slice(0, 300) : null
}

async function assertAcuityAccess(page: Page, context: string): Promise<void> {
	if (isSquarespaceLoginUrl(page.url())) {
		const pageMessage = await loginPageMessage(page)
		const message = pageMessage ? ` Login page message: ${pageMessage}` : ''
		await failWithPageContext(
			page,
			`${context}: Acuity login did not complete or the session expired.${message}`,
		)
	}

	if (isAuthChallengeUrl(page.url())) {
		await failWithPageContext(
			page,
			`${context}: Squarespace returned an authentication challenge that cannot be completed in CI.`,
		)
	}
}

async function waitForLoginAttempt(page: Page): Promise<void> {
	await page
		.waitForURL((url) => !isSquarespaceLoginUrl(url.toString()), {
			timeout: 30 * 1000,
		})
		.catch(() => undefined)

	await page.waitForLoadState('networkidle', { timeout: 10 * 1000 }).catch(() => undefined)

	const pageMessage = await loginPageMessage(page)
	if (pageMessage) {
		await failWithPageContext(page, `Acuity login was rejected. Login page message: ${pageMessage}`)
	}
}

async function openAcuitySlotPage(page: Page, slotUrl: string): Promise<void> {
	await page.goto(slotUrl, { waitUntil: 'domcontentloaded' })
	await page.waitForLoadState('networkidle', { timeout: 10 * 1000 }).catch(() => undefined)
	await assertAcuityAccess(page, `Opening Acuity slot ${slotUrl}`)
}

async function waitForOfferClassButton(page: Page, slotUrl: string): Promise<Locator> {
	const offerClassButton = await schedulingLocator(page, offerClassButtonSelector)

	try {
		await offerClassButton.first().waitFor({ state: 'visible', timeout: 45 * 1000 })
	} catch (error) {
		await assertAcuityAccess(page, `Loading Acuity slot ${slotUrl}`)
		await failWithPageContext(
			page,
			`Acuity appointment editor did not load for ${slotUrl}. Expected ${offerClassButtonSelector}.`,
			error,
		)
	}

	return offerClassButton
}

test.describe('Acuity Automation', () => {
	let slots = csvToJson.fieldDelimiter(';').getJsonFromCsv(csvFilePath)
	let page: Page
	test.beforeAll(async ({ browser }) => {
		//remove existing test failures csv
		//add new one with expected values
		page = await browser.newPage()
		await test.step('Login to Acuity Scheduling', async () => {
			const acuityUser = requireEnv('ACUITY_USER')
			const acuityPassword = requireEnv('ACUITY_PASSWORD')

			await page.goto('https://login.squarespace.com/')
			await page.locator('[placeholder="name\\@example\\.com"]').clear()
			await page.locator('[placeholder="name\\@example\\.com"]').fill(acuityUser)
			await page.locator('[placeholder="Password"]').clear()
			await page.locator('[placeholder="Password"]').fill(acuityPassword)
			await page.locator('[data-test="login-button"]').click()
			await waitForLoginAttempt(page)
			await openAcuitySlotPage(page, slots[0].URL)
			await waitForOfferClassButton(page, slots[0].URL)
		})
	})

	for (let index = 0; index < slots.length; index++) {
		test(`Add Acuity Slots: ${slots[index].Partner_region_zone};${slots[index].AppointmentID};${slots[index].URL};${slots[index].DateOffered};${slots[index].CalendarName};${slots[index].TimeOffered};${slots[index].LinkText};${slots[index].Availability} @helper`, async ({}, workerInfo) => {
			test.skip(workerInfo.project.name === 'Mobile Chrome')
			await test.step(`Create Slot on ${slots[index].DateOffered} - ${slots[index].TimeOffered}`, async () => {
				//Navigate to Zone
				await openAcuitySlotPage(page, slots[index].URL)

				// Start Create Slot
				const offerClassButton = await waitForOfferClassButton(page, slots[index].URL)
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
