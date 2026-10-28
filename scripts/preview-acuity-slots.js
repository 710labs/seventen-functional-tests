const fs = require('node:fs')
const { chromium } = require('playwright')
const { loadSlots, readSessions, planSlot } = require('./acuity-slot-reconciliation')

async function previewSlots(page, slots) {
	const groups = new Map()
	for (const slot of slots) {
		if (!groups.has(slot.AppointmentID)) groups.set(slot.AppointmentID, [])
		groups.get(slot.AppointmentID).push(slot)
	}
	const counts = { create: 0, update_capacity: 0, skip: 0, blocked: 0 }
	const rows = []
	for (const group of groups.values()) {
		// Read each appointment type once; this function never opens a save form.
		const sessions = await readSessions(page, group[0])
		for (const slot of group) {
			let plan
			try {
				plan = planSlot(slot, sessions)
			} catch (error) {
				plan = { action: 'blocked', reason: error.message }
			}
			counts[plan.action]++
			rows.push({ slot, ...plan })
		}
	}
	return {
		checkedAt: new Date().toISOString(),
		total: slots.length,
		appointmentTypes: groups.size,
		counts,
		rows,
	}
}

async function main() {
	const filename = process.env.ACUITY_SLOT_FILE || process.argv[2]
	if (!filename) throw new Error('Set ACUITY_SLOT_FILE or supply a CSV path.')
	const slots = loadSlots(filename)
	const storageState =
		process.env.ACUITY_STORAGE_STATE_FILE ||
		['.auth/acuity-storage-state.slim.json', '.auth/acuity-storage-state.json'].find(file =>
			fs.existsSync(file),
		)
	if (!storageState)
		throw new Error('No saved Acuity session. Run npm run helper:acuityslots:auth first.')
	const browser = await chromium.launch({ headless: true })
	try {
		const context = await browser.newContext({ storageState })
		const report = await previewSlots(await context.newPage(), slots)
		const { create, update_capacity, skip, blocked } = report.counts
		const summary = `Acuity preview: ${report.total} rows across ${report.appointmentTypes} appointment types; ${create} missing, ${update_capacity} capacity updates, ${skip} already correct, ${blocked} blocked. No slots were changed.`
		console.log(summary)
		if (process.env.GITHUB_STEP_SUMMARY)
			fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
		// Detailed data is opt-in for local diagnosis; CI prints only aggregate counts.
		if (process.env.ACUITY_PREVIEW_OUTPUT)
			fs.writeFileSync(process.env.ACUITY_PREVIEW_OUTPUT, JSON.stringify(report, null, 2) + '\n')
		if (blocked) process.exitCode = 1
	} finally {
		await browser.close()
	}
}

if (require.main === module)
	main().catch(() => {
		console.error(
			'Acuity preview failed before completing all rows. Verify saved authentication and inspect the editor layout before uploading.',
		)
		process.exitCode = 1
	})

module.exports = { previewSlots }
