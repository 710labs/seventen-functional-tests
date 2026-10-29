const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('playwright')
const {
	desiredSlot,
	parseSession,
	planSlot,
	reconcileSlot,
	submitOnce,
	verifySaved,
	loadSlots,
} = require('./acuity-slot-reconciliation')
const { previewSlots } = require('./preview-acuity-slots')

const slot = {
	AppointmentID: '123',
	DateOffered: '11/3/2026',
	TimeOffered: '11:00am',
	CalendarName: 'Test calendar (Eastern Time)',
	Availability: '15',
}
const session = (overrides = {}) => ({
	...desiredSlot(slot),
	capacity: 15,
	booked: 0,
	sessionId: '456',
	url: 'https://secure.acuityscheduling.com/appointments.php?action=detailAvailableGroup&id=456',
	...overrides,
})

test('matches standard time labels without relying on CSV timezone text', () => {
	const parsed = parseSession(
		{
			label: '11:00am EST Tuesday, November  3, 2026',
			details: '11:00am EST Tuesday, November 3, 2026 with Test calendar (0/15 attendees)',
			href: '/appointments.php?action=detailAvailableGroup&id=456',
		},
		'123',
	)
	assert.equal(
		planSlot({ ...slot, LinkText: '11:00am EDT Tuesday, November 3, 2026' }, [parsed]).action,
		'skip',
	)
})

test('distinguishes missing, matching, wrong capacity, and different local times', () => {
	assert.equal(planSlot(slot, []).action, 'create')
	assert.equal(planSlot(slot, [session()]).action, 'skip')
	assert.equal(planSlot(slot, [session({ capacity: 30 })]).action, 'update_capacity')
	assert.equal(planSlot({ ...slot, TimeOffered: '1:00pm' }, [session()]).action, 'create')
})

test('blocks duplicate sessions, wrong calendar, unreadable capacity, and unsafe reductions', () => {
	assert.throws(() => planSlot(slot, [session(), session({ sessionId: '789' })]), /Duplicate/)
	assert.throws(
		() => planSlot(slot, [session({ calendar: 'Other calendar' })]),
		/different calendar/,
	)
	assert.throws(() => planSlot(slot, [session({ capacity: null })]), /Cannot verify/)
	assert.throws(() => planSlot(slot, [session({ booked: 16 })]), /below/)
})

test('fails closed for changed labels and invalid dates', () => {
	assert.throws(() => parseSession({ label: 'Unrecognized layout' }, '123'), /Unrecognized/)
	assert.throws(() => desiredSlot({ ...slot, DateOffered: '2/30/2026' }), /Invalid/)
})

test('normalizes quoted CSV rows in memory and rejects duplicate slot identities', t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'acuity-csv-'))
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
	const filename = path.join(directory, 'slots.csv')
	const header = '\uFEFFAppointment ID;Date Offered;Time Offered;Calendar Name;Availability\n'
	const row = '"123;11/3/2026;11:00am;Test calendar (Eastern Time);15"\n'
	fs.writeFileSync(filename, header + row)
	assert.deepEqual(loadSlots(filename), [slot])
	assert.equal(fs.readFileSync(filename, 'utf8'), header + row)
	fs.writeFileSync(filename, header + row + row)
	assert.throws(() => loadSlots(filename), /duplicate/)
})

test('ambiguous save is submitted only once', async () => {
	let clicks = 0
	const page = {
		getByRole: () => ({ isVisible: async () => false }),
		waitForResponse: async () => {
			throw new Error('Timed out')
		},
	}
	await assert.rejects(
		submitOnce(
			page,
			{
				click: async () => {
					clicks++
				},
			},
			'0',
		),
		/Timed out/,
	)
	assert.equal(clicks, 1)
})

// Browser fixtures use intercepted Acuity URLs. No requests reach Acuity and no saved auth is loaded.
async function fixture(t, { initial = [], ajax = false, persist = true, datePicker = false } = {}) {
	const browser = await chromium.launch({ headless: true })
	t.after(() => browser.close())
	const context = await browser.newContext()
	const state = { sessions: initial, saves: [] }
	const editor = () =>
		`<a id="offer-class-btn" href="/appointments.php?action=addAvailableGroup&type=123">Offer Class</a>${state.sessions.map(s => `<label><a href="/appointments.php?action=detailAvailableGroup&id=${s.id}"><i></i></a><a href="/appointments.php?action=detailAvailableGroup&id=${s.id}">11:00am EST Tuesday, November 3, 2026</a><div>with Test calendar (0/${s.capacity} attendees)</div></label>`).join('')}`
	const form =
		id => `<button aria-label="Close survey" onclick="this.remove()">X</button><form method="post" action="/appointments.php?action=insertAvailableGroup&id=${id}" ${ajax ? 'onsubmit="event.preventDefault();fetch(this.action,{method:\'POST\',body:new URLSearchParams(new FormData(this))})"' : ''}>
		<select name="type"><option value="123">Test type</option></select><select name="calendar"><option value="1">Test calendar (Eastern Time)</option></select>
		<input id="date-input" name="date[]"><input placeholder="Ex. 9:00am" name="time[]"><input name="group_max" value="30"><input type="submit" value="${id === '0' ? 'Save Class' : 'Save Changes'}"></form>
		${
			datePicker
				? `<div id="date-picker" hidden style="position:fixed;z-index:1000;background:white">Calendar</div><script>
		const picker = document.querySelector('#date-picker')
		document.querySelector('#date-input').addEventListener('focus', () => {
			const box = document.querySelector('input[type=submit]').getBoundingClientRect()
			Object.assign(picker.style, { left: box.x+'px', top: box.y+'px', width: box.width+'px', height: box.height+'px' })
			picker.hidden = false
		})
		document.addEventListener('keydown', event => {
			if (event.key === 'Escape') picker.hidden = true
		})
		</script>`
				: ''
		}`
	await context.route('**/*', async route => {
		const request = route.request()
		const url = new URL(request.url())
		assert.equal(url.origin, 'https://secure.acuityscheduling.com')
		const action = url.searchParams.get('action')
		let body
		if (request.method() === 'POST') {
			assert.equal(action, 'insertAvailableGroup')
			const id = url.searchParams.get('id')
			const data = new URLSearchParams(request.postData())
			state.saves.push({ id, data: Object.fromEntries(data) })
			if (persist) {
				if (id === '0') state.sessions.push({ id: '456', capacity: 30 })
				else state.sessions.find(s => s.id === id).capacity = Number(data.get('group_max'))
			}
			body = editor()
		} else if (action === 'editAppointmentType') body = editor()
		else if (action === 'addAvailableGroup') body = form('0')
		else if (action === 'detailAvailableGroup')
			body = `<button data-testid="edit-appointment-button" onclick="document.querySelector('#edit').hidden=false">Edit</button><div id="edit" hidden>${form(url.searchParams.get('id'))}</div>`
		else throw new Error('Unexpected fixture request')
		await route.fulfill({ status: 200, contentType: 'text/html', body })
	})
	return { page: await context.newPage(), state }
}

test('read-only preview checks every row with zero saves', async t => {
	const { page, state } = await fixture(t, { initial: [{ id: '456', capacity: 30 }] })
	const result = await previewSlots(page, [slot, { ...slot, TimeOffered: '1:00pm' }])
	assert.deepEqual(result.counts, { create: 1, update_capacity: 1, skip: 0, blocked: 0 })
	assert.equal(result.rows.length, 2)
	assert.equal(state.saves.length, 0)
})

test('existing correct slot produces no writes', async t => {
	const { page, state } = await fixture(t, { initial: [{ id: '456', capacity: 15 }] })
	assert.equal((await reconcileSlot(page, slot)).action, 'skipped_existing')
	assert.equal(state.saves.length, 0)
})

test('partial upload repairs capacity without recreating the slot', async t => {
	const { page, state } = await fixture(t, { initial: [{ id: '456', capacity: 30 }] })
	assert.equal((await reconcileSlot(page, slot)).action, 'updated_capacity')
	assert.deepEqual(
		state.saves.map(s => s.id),
		['456'],
	)
	assert.equal(state.sessions[0].capacity, 15)
	assert.equal((await reconcileSlot(page, slot)).action, 'skipped_existing')
	assert.equal(state.saves.length, 1)
})

for (const ajax of [false, true])
	test(`missing slot is created, capacity verified, then skipped on rerun (AJAX=${ajax})`, async t => {
		const { page, state } = await fixture(t, { ajax })
		assert.equal((await reconcileSlot(page, slot)).action, 'created')
		assert.deepEqual(
			state.saves.map(s => s.id),
			['0', '456'],
		)
		assert.equal(state.saves[0].data['date[]'], slot.DateOffered)
		assert.equal(state.saves[0].data['time[]'], slot.TimeOffered)
		assert.equal(state.sessions[0].capacity, 15)
		assert.equal((await reconcileSlot(page, slot)).action, 'skipped_existing')
		assert.equal(state.saves.length, 2)
	})

test('a successful HTTP response alone cannot count as a saved slot', async t => {
	const { page, state } = await fixture(t, { persist: false })
	await page.goto(
		'https://secure.acuityscheduling.com/appointments.php?action=addAvailableGroup&type=123',
	)
	await submitOnce(page, page.getByRole('button', { name: 'Save Class', exact: true }), '0')
	assert.equal(state.saves.length, 1)
	await assert.rejects(
		verifySaved(page, slot, true, { timeoutMs: 10, intervalMs: 1 }),
		/could not be verified/,
	)
})

test('Escape dismisses the date picker before saving a missing slot', async t => {
	const { page, state } = await fixture(t, { datePicker: true })
	await page.goto(
		'https://secure.acuityscheduling.com/appointments.php?action=addAvailableGroup&type=123',
	)
	await page.locator('#date-input').fill(slot.DateOffered)
	await page.getByPlaceholder('Ex. 9:00am', { exact: true }).fill(slot.TimeOffered)
	assert.equal(await page.locator('#date-picker').isVisible(), true)
	// A focus-only fill reproduces the real failure without submitting anything.
	await assert.rejects(
		page
			.getByRole('button', { name: 'Save Class', exact: true })
			.click({ trial: true, timeout: 300 }),
		/Timeout/,
	)
	assert.equal(state.saves.length, 0)
	assert.equal((await reconcileSlot(page, slot)).action, 'created')
	assert.equal(state.sessions[0].capacity, 15)
	assert.deepEqual(
		state.saves.map(s => s.id),
		['0', '456'],
	)
})
