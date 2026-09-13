const assert = require('node:assert/strict')
const test = require('node:test')

const {
	acuityLoginMethod,
	authPageDescription,
	isAcuityUrl,
	isSquarespaceLoginUrl,
} = require('./create-acuity-storage-state')

function pageWith(url, bodyText) {
	return {
		locator() {
			return {
				async innerText() {
					return bodyText
				},
			}
		},
		url() {
			return url
		},
	}
}

test('recognizes both Squarespace and Acuity authentication hosts', () => {
	assert.equal(isSquarespaceLoginUrl('https://login.squarespace.com/api/1/login'), true)
	assert.equal(
		isAcuityUrl(
			'https://secure.acuityscheduling.com/appointments.php?action=editAppointmentType&id=1',
		),
		true,
	)
	assert.equal(isAcuityUrl('https://example.com/appointments.php'), false)
	assert.equal(isAcuityUrl('https://notacuityscheduling.com/appointments.php'), false)
})

test('recognizes the email-first Acuity login page at an editor URL', async () => {
	const page = pageWith(
		'https://secure.acuityscheduling.com/appointments.php?action=editAppointmentType&id=1',
		'You have been automatically logged out after a period of inactivity. Log in to Acuity Scheduling. Email address.',
	)

	assert.equal(await authPageDescription(page), 'expired Acuity session page')
})

test('recognizes the Acuity and Squarespace login-method choice', async () => {
	const page = pageWith(
		'https://secure.acuityscheduling.com/appointments.php?action=editAppointmentType&id=1',
		'Continue with Acuity Scheduling. Continue with Squarespace.',
	)

	assert.equal(await authPageDescription(page), 'Acuity login-method choice page')
})

test('uses Squarespace by default and supports an explicit legacy Acuity method', () => {
	const originalMethod = process.env.ACUITY_LOGIN_METHOD

	try {
		delete process.env.ACUITY_LOGIN_METHOD
		assert.equal(acuityLoginMethod(), 'squarespace')

		process.env.ACUITY_LOGIN_METHOD = 'acuity'
		assert.equal(acuityLoginMethod(), 'acuity')

		process.env.ACUITY_LOGIN_METHOD = 'unsupported'
		assert.throws(() => acuityLoginMethod(), /Unsupported ACUITY_LOGIN_METHOD/)
	} finally {
		if (originalMethod === undefined) {
			delete process.env.ACUITY_LOGIN_METHOD
		} else {
			process.env.ACUITY_LOGIN_METHOD = originalMethod
		}
	}
})
