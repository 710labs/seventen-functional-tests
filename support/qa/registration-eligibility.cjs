async function isRegistrationEligibilityVisible(page) {
	const onAccountPage = /^\/my-account(?:\/|$)/.test(new URL(page.url()).pathname)
	const registerButton = page.getByRole('button', { name: /^register$/i })
	if (onAccountPage || !(await registerButton.isVisible().catch(() => false))) {
		return false
	}

	const controls = [
		page.locator('#eligibilityContext'),
		page.locator('input[name="svntn_core_personal_doc"]'),
		page.locator('input[name="svntn_last_usage_type"]'),
		page.getByText(/complete your account/i),
		page.getByText(/id upload/i),
	]
	for (const control of controls) {
		if (await control.first().isVisible().catch(() => false)) return true
	}
	return false
}

async function waitForRegistrationEligibility(page, expect) {
	// The shop can render the registration panel after the redirect.
	await expect.poll(() => isRegistrationEligibilityVisible(page), { timeout: 20000 }).toBe(true)
}

module.exports = { isRegistrationEligibilityVisible, waitForRegistrationEligibility }
