const assert = require('node:assert/strict')
const test = require('node:test')

const {
	acuityLoginMethod,
	authPageDescription,
	isAcuityAccountSelectionText,
	isAcuityUrl,
	isLoggedOutNoticeText,
	isOptionalEmailVerificationText,
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
		"We've logged you out due to inactivity. Log in to Acuity Scheduling. Email address.",
	)

	assert.equal(await authPageDescription(page), 'expired Acuity session page')
	assert.equal(isLoggedOutNoticeText("We've logged you out due to inactivity."), true)
})

test('recognizes the Acuity and Squarespace login-method choice', async () => {
	const page = pageWith(
		'https://secure.acuityscheduling.com/appointments.php?action=editAppointmentType&id=1',
		'Continue with Acuity Scheduling. Continue with Squarespace.',
	)

	assert.equal(await authPageDescription(page), 'Acuity login-method choice page')
})

test('recognizes the optional Squarespace email-verification screen', async () => {
	const bodyText =
		"Verify your email address. Keep your account secure by entering the authentication code that was sent to you. Didn't get an email? SKIP VERIFY"
	const page = pageWith('https://login.squarespace.com/verification', bodyText)

	assert.equal(isOptionalEmailVerificationText(bodyText), true)
	assert.equal(
		await authPageDescription(page),
		'optional Squarespace email-verification page',
	)
})

test('recognizes the Acuity account chooser containing the 710 Labs account', async () => {
	const bodyText =
		'Select an account to continue 710 Labs https://710labs.as.me/ Your Business Name (self)'
	const page = pageWith(
		'https://secure.acuityscheduling.com/oauth2/squarespace-standalone/callback',
		bodyText,
	)

	assert.equal(isAcuityAccountSelectionText(bodyText), true)
	assert.equal(await authPageDescription(page), 'Acuity account-selection page')
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
