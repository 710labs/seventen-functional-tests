import { Page, test } from '@playwright/test'
import { AdminLogin } from '../../models/admin/admin-login-page'
import caDeliveryZones from '../delivery-zones-ca.json'
import flDeliveryZones from '../delivery-zones-fl.json'
const csvFilePath = 'utils/delivery-slots.csv'
let csvToJson = require('convert-csv-to-json')
const { Parser } = require('json2csv')

test.describe('Acuity Helpers', () => {
	var today = new Date()
	var currentYear = today.getFullYear()
	var PDTCutoff = new Date(currentYear, 10, 1)
	var PSTCutoff = new Date(currentYear, 2, 1)

	var dates = []
	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December',
	]
	var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

	function timezone() {
		if (today > PSTCutoff && today < PDTCutoff) {
			return 'PDT'
		} else return 'PST'
	}

	test.beforeAll(async () => {
		for (let index = 1; index < 10; index++) {
			var currentDate = new Date()
			currentDate.setDate(currentDate.getDate() + index)
			dates.push(currentDate)
		}
	})

	for (let index = 0; index < caDeliveryZones.length; index++) {
		test(`Add CA Acuity Slots: ${caDeliveryZones[index]} @helper`, async ({
			page,
			browserName,
		}, workerInfo) => {
			test.skip(workerInfo.project.name === 'Mobile Chrome')
			var acuityUrl
			await test.step('Login to Wordpress Admin', async () => {
				await page.goto('/wp-admin')
				await page.locator('input[name="log"]').fill(`${process.env.ADMIN_USER}`)
				await page.locator('input[name="pwd"]').fill(`${process.env.ADMIN_PW}`)
				await page.locator('text=Log In').click()
			})

			await test.step('Navigate to Delivery Dashboard', async () => {
				await page.goto(
					'https://thelist-dev.710labs.com/wp-admin/admin.php?page=svntn-delivery-dashboard',
				)
			})
			await test.step(`Navigate to Acuity Scheduling ${caDeliveryZones[index]}`, async () => {
				acuityUrl = await page
					.locator(`text=${caDeliveryZones[index]}`)
					.evaluate(e => e.getAttribute('href'))
				await page.locator(`text=${caDeliveryZones[index]}`).click()
			})
			await test.step('Login to Acuity Scheduling', async () => {
				await page
					.locator('[placeholder="name\\@example\\.com"]')
					.fill(`${process.env.ACUITY_USER}`)
				await page.locator('[placeholder="Password"]').fill(`${process.env.ACUITY_PASSWORD}`)
				await Promise.all([
					page.waitForNavigation(),
					page.locator('[data-test="login-button"]').click(),
				])
			})
			for (let index = 0; index < dates.length; index++) {
				await test.step(`Create Slot on ${dates[index].toLocaleDateString()}`, async () => {
					await page.waitForNavigation()
					//Navigate to Zone
					await page.goto(acuityUrl)
					await page.waitForTimeout(20000)
					await page.goto(acuityUrl)
					//Start Create Slot
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator('[data-testid="offer-class"]')
						.first()
						.click()
					//Select "Another Test Calendar"
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator('select[name="calendar"]')
						.selectOption('6156957')
					//Date Selector
					//Select Day of Month
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator('#date-input')
						.fill(
							`${dates[index].getMonth() + 1}/${dates[index].getDate()}/${dates[
								index
							].getFullYear()}`,
						)
					//Select Time
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator('[placeholder="Ex\\. 9\\:00am"]')
						.click()
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator('[placeholder="Ex\\. 9\\:00am"]')
						.fill('9AM')

					//Save Class
					await Promise.all([
						page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
						page.frameLocator('[data-test="scheduling-iframe"]').locator('text=Save Class').click(),
					])

					//Edit Capacity
					//Select Slot
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator(
							`text=9:00am ${timezone} ${days[dates[index].getDay()]}, ${
								months[dates[index].getMonth()]
							} ${dates[index].getDate()}, ${dates[index].getFullYear()}`,
						)
						.click()

					//Click Edit
					await page.frameLocator('[data-test="scheduling-iframe"]').locator('text=Edit').click()

					//Edit Capacity Value
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator('text=Max number of people for this class >> input[name="group_max"]')
						.click()
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator('text=Max number of people for this class >> input[name="group_max"]')
						.fill('100')

					//Save Slot
					await Promise.all([
						page.waitForNavigation(/*{ url: 'https://koi-mandolin-afct.squarespace.com/config/scheduling/appointments.php?action=editAppointmentType&id=27879714' }*/),
						page
							.frameLocator('[data-test="scheduling-iframe"]')
							.locator('text=Save Changes')
							.click(),
					])
				})
			}
		})
	}

	for (let index = 0; index < flDeliveryZones.length; index++) {
		test(`Add FL Acuity Slots: ${flDeliveryZones[index]} @helper`, async ({
			page,
			browserName,
		}, workerInfo) => {
			test.skip(workerInfo.project.name === 'Mobile Chrome')
			var acuityUrl
			const adminLoginPage = new AdminLogin(page)
			await test.step('Login Admin', async () => {
				await adminLoginPage.login()
			})
			await test.step('Navigate to Delivery Dashboard', async () => {
				await Promise.all([
					await page.goto(
						'https://thelist-dev.710labs.com/wp-admin/admin.php?page=svntn-delivery-dashboard',
					),
				])
			})
			await test.step(`Navigate to Acuity Scheduling ${flDeliveryZones[index]}`, async () => {
				;(acuityUrl = await page
					.locator(`text=${flDeliveryZones[index]}`)
					.evaluate(e => e.getAttribute('href'))),
					await page.locator(`text=${flDeliveryZones[index]}`).click()
			})
			await test.step('Login to Acuity Scheduling', async () => {
				await page
					.locator('[placeholder="name\\@example\\.com"]')
					.fill(`${process.env.ACUITY_USER}`)
				await page.locator('[placeholder="Password"]').fill(`${process.env.ACUITY_PASSWORD}`)
				await Promise.all([
					page.waitForNavigation(),
					page.locator('[data-test="login-button"]').click(),
					page.waitForNavigation(),
				])
			})
			for (let index = 0; index < dates.length; index++) {
				await test.step(`Create Slot on ${dates[index].toLocaleDateString()}`, async () => {
					await page.waitForTimeout(12000)
					//Navigate to Zone
					await page.goto(acuityUrl)
					await page.waitForTimeout(12000)
					await page.goto(acuityUrl)
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
						.selectOption('6156957')
					// Date Selector
					// Select Day of Month
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator('#date-input')
						.fill(
							`${dates[index].getMonth() + 1}/${dates[index].getDate()}/${dates[
								index
							].getFullYear()}`,
						)

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
						page.waitForNavigation(),
						page.frameLocator('[data-test="scheduling-iframe"]').locator('text=Save Class').click(),
					])

					//Edit Capacity
					//Select Slot
					await page
						.frameLocator('[data-test="scheduling-iframe"]')
						.locator(
							`text=9:00am PST ${days[dates[index].getDay()]}, ${
								months[dates[index].getMonth()]
							} ${dates[index].getDate()}, ${dates[index].getFullYear()}`,
						)
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
						page.waitForNavigation(),
						page
							.frameLocator('[data-test="scheduling-iframe"]')
							.locator('text=Save Changes')
							.click(),
					])
				})
			}
		})
	}
})
