const fs = require('node:fs')
const { setTimeout: delay } = require('node:timers/promises')

const origin = 'https://secure.acuityscheduling.com'
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
const compact = value =>
	String(value || '')
		.replace(/\s+/g, ' ')
		.trim()

function dateKey(value) {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(compact(value))
	if (!match) throw new Error('Invalid Acuity slot date; expected M/D/YYYY.')
	const [, month, day, year] = match.map(Number)
	const date = new Date(Date.UTC(year, month - 1, day))
	if (
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day ||
		date.getUTCFullYear() !== year
	)
		throw new Error('Invalid Acuity slot date.')
	return date.toISOString().slice(0, 10)
}

function timeKey(value) {
	const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(compact(value))
	if (!match || +match[1] < 1 || +match[1] > 12 || +match[2] > 59)
		throw new Error('Invalid Acuity slot time.')
	return ((+match[1] % 12) + (match[3].toLowerCase() === 'pm' ? 12 : 0)) * 60 + +match[2]
}

function calendarName(value) {
	return compact(value).replace(/ \((?:Eastern|Central|Mountain|Pacific) Time\)$/, '')
}

function desiredSlot(slot) {
	if (
		!/^\d+$/.test(slot.AppointmentID) ||
		!/^\d+$/.test(slot.Availability) ||
		!calendarName(slot.CalendarName)
	)
		throw new Error('Invalid Acuity slot identity or capacity.')
	const capacity = Number(slot.Availability)
	if (!Number.isSafeInteger(capacity)) throw new Error('Invalid Acuity slot capacity.')
	return {
		appointmentId: slot.AppointmentID,
		date: dateKey(slot.DateOffered),
		time: timeKey(slot.TimeOffered),
		calendar: calendarName(slot.CalendarName),
		capacity,
	}
}

function slotKey(slot) {
	return JSON.stringify([slot.appointmentId, slot.date, slot.time, slot.calendar])
}

function loadSlots(filename) {
	// Some exports quote each entire semicolon-delimited row. Normalize in memory only.
	const content = fs
		.readFileSync(filename, 'utf8')
		.replace(/^\uFEFF/, '')
		.split(/\r?\n/)
		.map((line, i) => {
			const trimmed = line.trim()
			return i > 0 && trimmed.startsWith('"') && trimmed.endsWith('"')
				? trimmed.slice(1, -1).replace(/""/g, '"')
				: line
		})
		.join('\n')
	const rows = require('convert-csv-to-json').fieldDelimiter(';').csvStringToJson(content)
	if (!rows.length) throw new Error('Acuity slot CSV is empty.')
	const seen = new Set()
	for (const row of rows) {
		const key = slotKey(desiredSlot(row))
		if (seen.has(key)) throw new Error('The CSV contains duplicate Acuity slots.')
		seen.add(key)
	}
	return rows
}

function editorUrl(slot) {
	const desired = desiredSlot(slot)
	return `${origin}/appointments.php?action=editAppointmentType&id=${desired.appointmentId}`
}

function parseSession(record, appointmentId) {
	const label = compact(record.label)
	const match = /^(\d{1,2}:\d{2}\s*[ap]m) ([A-Z]+) \w+, (\w+) (\d{1,2}), (\d{4})$/.exec(label)
	if (!match || !months.includes(match[3]))
		throw new Error('Unrecognized Acuity class label; refusing to infer a missing slot.')
	const details = compact(record.details)
	const calendar = /\bwith (.+?)(?: \(\d+\/\d+ attendees\))?$/.exec(details)
	if (!calendar) throw new Error('Unable to identify the Acuity class calendar.')
	const capacity = /\((\d+)\/(\d+) attendees\)$/.exec(details)
	const url = new URL(record.href, origin)
	if (
		url.origin !== origin ||
		url.pathname !== '/appointments.php' ||
		url.searchParams.get('action') !== 'detailAvailableGroup' ||
		!/^\d+$/.test(url.searchParams.get('id') || '')
	)
		throw new Error('Unexpected Acuity class link.')
	return {
		appointmentId,
		date: dateKey(`${months.indexOf(match[3]) + 1}/${match[4]}/${match[5]}`),
		time: timeKey(match[1]),
		calendar: calendar[1],
		capacity: capacity ? Number(capacity[2]) : null,
		booked: capacity ? Number(capacity[1]) : null,
		timezone: match[2],
		label,
		url: url.href,
		sessionId: url.searchParams.get('id'),
	}
}

function planSlot(slot, sessions) {
	const desired = desiredSlot(slot)
	const matches = sessions.filter(session => slotKey(session) === slotKey(desired))
	if (matches.length > 1)
		throw new Error(
			'Duplicate Acuity sessions already exist for this slot; reconcile them before uploading.',
		)
	if (!matches.length) {
		if (
			sessions.some(
				s =>
					s.appointmentId === desired.appointmentId &&
					s.date === desired.date &&
					s.time === desired.time,
			)
		)
			throw new Error(
				'This slot exists on a different calendar; refusing to create another session.',
			)
		return { action: 'create' }
	}
	const session = matches[0]
	if (session.capacity === null || session.booked === null)
		throw new Error('Cannot verify the existing Acuity slot capacity.')
	if (desired.capacity < session.booked)
		throw new Error('Requested capacity is below the number of booked attendees.')
	return { action: session.capacity === desired.capacity ? 'skip' : 'update_capacity', session }
}

async function dismissSurvey(page) {
	const close = page.getByRole('button', { name: 'Close survey', exact: true })
	if (await close.isVisible()) await close.click({ timeout: 3000 })
}

async function readSessions(page, slot) {
	await page.goto(editorUrl(slot), { waitUntil: 'domcontentloaded', timeout: 30000 })
	await page
		.locator('#offer-class-btn, [data-testid="offer-class"]')
		.first()
		.waitFor({ state: 'visible', timeout: 15000 })
	if (page.url() !== editorUrl(slot))
		throw new Error('Acuity did not open the requested appointment editor.')
	const records = await page.locator('a[href*="detailAvailableGroup"]').evaluateAll(links =>
		links
			.filter(a => a.textContent.trim()) // Exclude the second, icon-only link for each session.
			.map(a => ({
				label: a.textContent,
				href: a.getAttribute('href'),
				details:
					a.closest('label')?.querySelector('.text-muted')?.textContent ||
					a.closest('label')?.innerText ||
					'',
			})),
	)
	const sessions = records.map(record => parseSession(record, slot.AppointmentID))
	return [...new Map(sessions.map(session => [session.sessionId, session])).values()]
}

async function submitOnce(page, button, sessionId) {
	await dismissSurvey(page)
	// Observe the actual save request, including when Acuity saves through AJAX.
	// Never force-click or resubmit after an ambiguous timeout.
	const [response] = await Promise.all([
		page.waitForResponse(
			response => {
				const url = new URL(response.url())
				return (
					response.request().method() === 'POST' &&
					url.origin === origin &&
					url.pathname === '/appointments.php' &&
					url.searchParams.get('action') === 'insertAvailableGroup' &&
					url.searchParams.get('id') === String(sessionId)
				)
			},
			{ timeout: 30000 },
		),
		button.click({ timeout: 10000 }),
	])
	if (response.status() >= 400)
		throw new Error(
			`Acuity save returned HTTP ${response.status()}. Re-run reconciliation before retrying.`,
		)
	await response.finished()
}

async function verifySaved(
	page,
	slot,
	requireCapacity,
	{ timeoutMs = 30000, intervalMs = 1000 } = {},
) {
	// A separate page does not interrupt a still-navigating save page.
	const probe = await page.context().newPage()
	const deadline = Date.now() + timeoutMs
	try {
		do {
			const plan = planSlot(slot, await readSessions(probe, slot))
			if (plan.action === 'skip' || (!requireCapacity && plan.action === 'update_capacity'))
				return plan
			if (Date.now() < deadline) await delay(intervalMs)
		} while (Date.now() < deadline)
		throw new Error(
			'Acuity save could not be verified. The session may exist; re-run reconciliation instead of blindly creating it again.',
		)
	} finally {
		await probe.close()
	}
}

async function setCapacity(page, slot, session) {
	await page.goto(session.url, { waitUntil: 'domcontentloaded', timeout: 30000 })
	await dismissSurvey(page)
	await page.getByTestId('edit-appointment-button').click({ timeout: 10000 })
	const capacity = page.locator('input[name="group_max"]')
	await capacity.waitFor({ state: 'visible', timeout: 10000 })
	// Ensure this edit still addresses the class/calendar we inspected.
	if (
		(await page.locator('select[name="type"]').inputValue()) !== slot.AppointmentID ||
		calendarName(await page.locator('select[name="calendar"] option:checked').innerText()) !==
			calendarName(slot.CalendarName)
	)
		throw new Error('Acuity edit form no longer matches the requested slot.')
	await capacity.fill(String(slot.Availability))
	await submitOnce(
		page,
		page.getByRole('button', { name: 'Save Changes', exact: true }),
		session.sessionId,
	)
	await verifySaved(page, slot, true)
}

async function reconcileSlot(page, slot) {
	const plan = planSlot(slot, await readSessions(page, slot))
	if (plan.action === 'skip')
		return { action: 'skipped_existing', sessionId: plan.session.sessionId }
	if (plan.action === 'update_capacity') {
		await setCapacity(page, slot, plan.session)
		return { action: 'updated_capacity', sessionId: plan.session.sessionId }
	}
	// Follow the form's link directly; Acuity's navigation overlay can intercept clicks.
	const href = await page
		.locator('#offer-class-btn, [data-testid="offer-class"]')
		.first()
		.getAttribute('href')
	const formUrl = new URL(href, origin)
	if (
		formUrl.origin !== origin ||
		formUrl.searchParams.get('action') !== 'addAvailableGroup' ||
		formUrl.searchParams.get('type') !== slot.AppointmentID
	)
		throw new Error('Unexpected Acuity create form link.')
	await page.goto(formUrl.href, { waitUntil: 'domcontentloaded', timeout: 30000 })
	await page.locator('select[name="type"]').selectOption(slot.AppointmentID)
	await page.locator('select[name="calendar"]').selectOption({ label: slot.CalendarName })
	await page.locator('#date-input').fill(slot.DateOffered)
	await page.getByPlaceholder('Ex. 9:00am', { exact: true }).fill(slot.TimeOffered)
	await submitOnce(page, page.getByRole('button', { name: 'Save Class', exact: true }), '0')
	const created = await verifySaved(page, slot, false)
	if (created.action === 'update_capacity') await setCapacity(page, slot, created.session)
	return { action: 'created', sessionId: created.session.sessionId }
}

module.exports = {
	dateKey,
	timeKey,
	calendarName,
	desiredSlot,
	slotKey,
	loadSlots,
	editorUrl,
	parseSession,
	planSlot,
	readSessions,
	submitOnce,
	verifySaved,
	reconcileSlot,
}
