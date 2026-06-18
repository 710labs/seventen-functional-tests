#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const csv = require('csvtojson')

const requiredFields = [
	'Partner',
	'Partner_region_zone',
	'Appointment ID',
	'URL',
	'Calendar Name',
	'Date Offered',
	'Time Offered',
	'Link Text',
	'Availability',
]

const inputPath = process.argv[2] || process.env.ACUITY_SLOT_FILE || 'utils/delivery-slots.csv'
const workspace = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd())
const resolvedPath = path.resolve(workspace, inputPath)
const relativePath = path.relative(workspace, resolvedPath)
const source = process.env.ACUITY_SLOT_SOURCE || inputPath

function isInsideWorkspace(relative) {
	return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function formatSource(value) {
	try {
		const url = new URL(value)
		if (url.search) {
			url.search = '?redacted'
		}
		return url.toString()
	} catch {
		return value
	}
}

function parseDate(value) {
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)

	if (!match) {
		return null
	}

	const month = Number(match[1])
	const day = Number(match[2])
	const year = Number(match[3])
	const date = new Date(Date.UTC(year, month - 1, day))

	if (
		date.getUTCFullYear() !== year ||
		date.getUTCMonth() !== month - 1 ||
		date.getUTCDate() !== day
	) {
		return null
	}

	return date
}

function appendSummary(lines) {
	const value = `${lines.join('\n')}\n`

	if (process.env.GITHUB_STEP_SUMMARY) {
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, value)
	}

	console.log(value)
}

function fail(message, details = []) {
	const lines = ['## Acuity Slot CSV Validation', '', `**Status:** Failed`, '', message]

	if (details.length > 0) {
		lines.push('', '```', ...details.slice(0, 20), '```')
	}

	appendSummary(lines)
	console.error(message)
	for (const detail of details.slice(0, 20)) {
		console.error(detail)
	}
	process.exit(1)
}

async function main() {
	if (!inputPath.trim()) {
		fail('No Acuity slot CSV path was provided.')
	}

	if (!isInsideWorkspace(relativePath)) {
		fail(`Acuity slot CSV must be inside the workspace: ${inputPath}`)
	}

	if (!fs.existsSync(resolvedPath)) {
		fail(`Acuity slot CSV does not exist: ${inputPath}`)
	}

	const stat = fs.statSync(resolvedPath)
	if (!stat.isFile()) {
		fail(`Acuity slot CSV path is not a file: ${inputPath}`)
	}

	const content = fs.readFileSync(resolvedPath, 'utf8')
	if (!content.trim()) {
		fail(`Acuity slot CSV is empty: ${inputPath}`)
	}

	const headerLine = content.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, '')
	const headers = headerLine.split(';').map(header => header.trim())
	const missingHeaders = requiredFields.filter(field => !headers.includes(field))
	if (missingHeaders.length > 0) {
		fail('Acuity slot CSV is missing required headers.', missingHeaders)
	}

	let rows
	try {
		rows = await csv({
			delimiter: ';',
			trim: true,
			checkType: false,
			ignoreEmpty: true,
		}).fromString(content)
	} catch (error) {
		fail(`Acuity slot CSV could not be parsed: ${error.message}`)
	}

	if (rows.length === 0) {
		fail(`Acuity slot CSV has no data rows: ${inputPath}`)
	}

	const errors = []
	const dates = []
	const zones = new Set()
	const calendars = new Set()

	for (const [index, row] of rows.entries()) {
		const rowNumber = index + 2
		const populatedFields = requiredFields.filter(field => String(row[field] || '').trim())

		if (
			populatedFields.length === 1 &&
			populatedFields[0] === 'Partner' &&
			String(row.Partner || '').includes(';')
		) {
			errors.push(`Row ${rowNumber}: row appears wrapped in outer quotes; remove row-level quotes`)
			continue
		}

		for (const field of requiredFields) {
			if (!String(row[field] || '').trim()) {
				errors.push(`Row ${rowNumber}: missing ${field}`)
			}
		}

		const url = String(row.URL || '').trim()
		if (url) {
			try {
				const parsedUrl = new URL(url)
				if (parsedUrl.protocol !== 'https:') {
					errors.push(`Row ${rowNumber}: URL must use https`)
				}
			} catch {
				errors.push(`Row ${rowNumber}: URL is not valid`)
			}
		}

		const date = String(row['Date Offered'] || '').trim()
		const parsedDate = parseDate(date)
		if (!parsedDate) {
			errors.push(`Row ${rowNumber}: Date Offered must use M/D/YYYY format`)
		} else {
			dates.push(parsedDate)
		}

		const availability = String(row.Availability || '').trim()
		if (availability && !/^\d+$/.test(availability)) {
			errors.push(`Row ${rowNumber}: Availability must be numeric`)
		}

		const zone = String(row.Partner_region_zone || '').trim()
		if (zone) {
			zones.add(zone)
		}

		const calendar = String(row['Calendar Name'] || '').trim()
		if (calendar) {
			calendars.add(calendar)
		}
	}

	if (errors.length > 0) {
		fail(`Acuity slot CSV has ${errors.length} validation error(s).`, errors)
	}

	dates.sort((left, right) => left.getTime() - right.getTime())
	const firstDate = dates[0].toISOString().slice(0, 10)
	const lastDate = dates[dates.length - 1].toISOString().slice(0, 10)
	const sortedZones = [...zones].sort()
	const sortedCalendars = [...calendars].sort()

	appendSummary([
		'## Acuity Slot CSV Validation',
		'',
		'**Status:** Passed',
		'',
		`- Source: ${formatSource(source)}`,
		`- File: ${relativePath || path.basename(resolvedPath)}`,
		`- Rows: ${rows.length}`,
		`- Date range: ${firstDate} to ${lastDate}`,
		`- Zones: ${sortedZones.length}`,
		`- Calendars: ${sortedCalendars.join(', ')}`,
		'',
		'<details><summary>Zone list</summary>',
		'',
		...sortedZones.map(zone => `- ${zone}`),
		'',
		'</details>',
	])
}

main().catch(error => {
	fail(`Unexpected Acuity slot validation failure: ${error.message}`)
})
