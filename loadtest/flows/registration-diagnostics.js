const VALIDATION_NOTICE_SELECTOR = [
	'.woocommerce-error',
	'.wc-block-components-notice-banner.is-error',
	'.eligibilityError',
	'.form-error',
	'.wcse-mod-error',
	'form [role="alert"]',
].join(', ')

async function registrationValidation(page) {
	return page.locator('body').evaluate((body, noticeSelector) => {
		const isVisible = element => element.getClientRects().length > 0 &&
			getComputedStyle(element).visibility === 'visible'
		const form = body.querySelector('input[name="svntn_core_registration_firstname"], input[name="billing_address_1"]')?.form
		const invalidField = form && [...form.elements].some(field => isVisible(field) &&
			field.matches(':user-invalid, [aria-invalid="true"], .woocommerce-invalid :is(input, select, textarea)'))
		const notice = [...body.querySelectorAll(noticeSelector)].some(element =>
			isVisible(element) && element.innerText.trim())

		return invalidField || notice ? 'visible' : 'none seen'
	}, VALIDATION_NOTICE_SELECTOR, { timeout: 1000 }).catch(() => 'unknown')
}

async function observeRegistration(page, nextButton) {
	const registrationUrl = new URL(page.url())
	const mainFrame = page.mainFrame()
	const form = await nextButton.evaluate(button => button.form && ({
		action: button.hasAttribute('formaction') ? button.formAction : button.form.action,
		method: button.hasAttribute('formmethod') ? button.formMethod : button.form.method,
	}), undefined, { timeout: 1000 }).catch(() => null)
	const actionUrl = form && URL.canParse(form.action, registrationUrl) && new URL(form.action, registrationUrl)
	const requests = new Map()
	let submission
	let possibleSubmission

	function onRequest(request) {
		const redirect = requests.get(request.redirectedFrom())
		if (redirect) {
			redirect.redirectStatus ??= redirect.status
			redirect.status = undefined
			redirect.responseAt = undefined
			redirect.finished = false
			requests.set(request, redirect)
			return
		}

		const url = new URL(request.url())
		const method = request.method()
		const navigation = request.isNavigationRequest()
		const ajax = ['fetch', 'xhr'].includes(request.resourceType()) && !['GET', 'HEAD', 'OPTIONS'].includes(method)
		if (url.origin !== registrationUrl.origin || (!navigation && !ajax)) return
		try {
			if (request.frame() !== mainFrame) return
		} catch {
			// Playwright may observe a request before its frame exists.
			return
		}

		const matchesForm = url.origin === actionUrl?.origin && url.pathname === actionUrl.pathname &&
			method.toLowerCase() === form.method.toLowerCase()
		const postsToRegistration = method === 'POST' && url.pathname === registrationUrl.pathname
		const confirmed = matchesForm || postsToRegistration
		if (confirmed ? submission : possibleSubmission) return

		const entry = { method, startedAt: performance.now(), confirmed }
		requests.set(request, entry)
		if (confirmed) submission = entry
		else possibleSubmission = entry
	}

	function onResponse(response) {
		const entry = requests.get(response.request())
		if (!entry) return
		entry.status = response.status()
		entry.responseAt = performance.now()
	}

	function onRequestFailed(request) {
		const entry = requests.get(request)
		if (entry) entry.failedAt = performance.now()
	}

	function onRequestFinished(request) {
		const entry = requests.get(request)
		if (entry) entry.finished = true
	}

	page.on('request', onRequest)
	page.on('response', onResponse)
	page.on('requestfailed', onRequestFailed)
	page.on('requestfinished', onRequestFinished)

	return {
		result() {
			const entry = submission || possibleSubmission
			if (!entry) return 'no request seen'
			let outcome = 'pending'
			if (entry.status) outcome = `HTTP ${entry.status}`
			if (entry.failedAt) outcome = entry.status ? `${outcome} then failed` : 'network failure'
			else if (entry.status && !entry.finished) outcome += ' incomplete'
			const redirect = entry.redirectStatus ? `${entry.redirectStatus} to ` : ''
			return `${entry.confirmed ? '' : 'possible '}${entry.method} ${redirect}${outcome}`
		},
		stop(events, eligible) {
			page.off('request', onRequest)
			page.off('response', onResponse)
			page.off('requestfailed', onRequestFailed)
			page.off('requestfinished', onRequestFinished)

			const entry = submission || possibleSubmission
			if (!entry) return
			const prefix = eligible ? 'registration.eligible' : 'registration.failed'
			if (entry.responseAt !== undefined) {
				events?.emit('histogram', `${prefix}.response_ms`, entry.responseAt - entry.startedAt)
			}
			if (entry.failedAt !== undefined) {
				events?.emit('histogram', `${prefix}.network_failure_ms`, entry.failedAt - entry.startedAt)
			} else if (!entry.finished) {
				events?.emit('histogram', `${prefix}.pending_ms`, performance.now() - entry.startedAt)
			}
		},
	}
}

module.exports = { observeRegistration, registrationValidation }
