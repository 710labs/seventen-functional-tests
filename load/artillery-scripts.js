async function caWorkflow(page, vuContext, events, test) {
	const { step } = test
	const userid = vuContext.vars.userid
	const recordid = vuContext.vars.recordid

	await step('Pass Age Gate', async () => {
		await step('Load 710 Labs ', async () => {
			await page.goto('https://thelist-stage.710labs.com')
		})

		await step('Click Age Gate Acceptance', async () => {
			await page.getByRole('button', { name: "I'm over 21 or a qualified" }).click()
		})
	})

	await step('Enter List Password', async () => {
		await step('Type and Submit List Password', async () => {
			const passwordField = await page.locator('input[name="post_password"]')
			await passwordField.click()
			await passwordField.fill('qatester')
		})
	})
}

async function coWorkflow(page) {}

async function miWorkflow(page) {}

module.exports = { caWorkflow, coWorkflow, miWorkflow }
