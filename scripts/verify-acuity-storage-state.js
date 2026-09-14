#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { chromium } = require('@playwright/test')

const defaultStorageStatePath = '.auth/acuity-storage-state.slim.json'
const defaultFullStorageStatePath = '.auth/acuity-storage-state.json'
const defaultVerificationUrl =
	'https://secure.acuityscheduling.com/appointments.php?action=editAppointmentType&id=74252273'
const offerClassButtonSelector = '#offer-class-btn, [data-testid="offer-class"]'
const defaultVerificationTimeoutMs = 45 * 1000
const defaultFreshCaptureMaxAgeMs = 15 * 60 * 1000

function fail(message) {
	console.error(message)
	process.exitCode = 1
}

function positiveInteger(value, fallback) {
	const parsed = Number.parseInt(value || '', 10)
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolvedWorkspacePath(filePath) {
	const workspace = process.cwd()
	const resolvedPath = path.resolve(workspace, filePath)
	const relativePath = path.relative(workspace, resolvedPath)
	if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		throw new Error(`Acuity storage state path must stay inside the workspace: ${filePath}`)
	}

	return resolvedPath
}

function readStorageState(filePath) {
	const resolvedPath = resolvedWorkspacePath(filePath)
	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`Acuity storage state file does not exist: ${filePath}`)
	}

	let state
	try {
		state = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
	} catch (error) {
		throw new Error(`Acuity storage state is not valid JSON: ${error.message}`)
	}

	if (!Array.isArray(state.cookies) || state.cookies.length === 0) {
		throw new Error(`Acuity storage state has no cookies: ${filePath}`)
	}

	return { resolvedPath, state }
}

function requireFreshCapture(filePath, maxAgeMs, now = Date.now()) {
	const resolvedPath = resolvedWorkspacePath(filePath)
	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`Full Acuity storage state file does not exist: ${filePath}`)
	}

	const ageMs = now - fs.statSync(resolvedPath).mtimeMs
	if (ageMs < 0 || ageMs > maxAgeMs) {
		throw new Error(
			`The captured Acuity storage state was not refreshed by this login run: ${filePath}. Its modified time is ${new Date(fs.statSync(resolvedPath).mtimeMs).toISOString()}. Log in inside the Playwright browser opened by npm run helper:acuityslots:auth, then close that browser so Playwright saves the new state.`,
		)
	}
}

function safePageUrl(rawUrl) {
	try {
		const parsedUrl = new URL(rawUrl)
		for (const parameter of ['email', 'state', 'code']) {
			if (parsedUrl.searchParams.has(parameter)) {
				parsedUrl.searchParams.set(parameter, 'redacted')
			}
		}
		return parsedUrl.toString()
	} catch {
		return rawUrl
	}
}

async function waitForEditor(page, timeoutMs) {
	const deadline = Date.now() + timeoutMs

	while (Date.now() < deadline) {
		const locators = [page.locator(offerClassButtonSelector).first()]
		for (const frame of page.frames().filter(candidate => candidate !== page.mainFrame())) {
			locators.push(frame.locator(offerClassButtonSelector).first())
		}

		if (
			(await Promise.all(locators.map(locator => locator.isVisible().catch(() => false)))).some(
				Boolean,
			)
		) {
			return
		}

		await page.waitForTimeout(250)
	}

	throw new Error(`Expected ${offerClassButtonSelector} to be visible within ${timeoutMs}ms.`)
}

async function verifyStorageState({
	storageStatePath = defaultStorageStatePath,
	verificationUrl = process.env.ACUITY_AUTH_VERIFY_URL || defaultVerificationUrl,
	timeoutMs = positiveInteger(
		process.env.ACUITY_STORAGE_STATE_VERIFY_TIMEOUT_MS,
		defaultVerificationTimeoutMs,
	),
} = {}) {
	const { resolvedPath, state } = readStorageState(storageStatePath)
	const browser = await chromium.launch({ headless: true })
	let page

	try {
		const context = await browser.newContext({ storageState: resolvedPath })
		page = await context.newPage()
		await page.goto(verificationUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
		await page.waitForLoadState('networkidle', { timeout: 10 * 1000 }).catch(() => undefined)
		const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '')
		if (
			/login\.squarespace\.com/i.test(page.url()) ||
			/we(?:'|’)ve logged you out|automatically logged out|log in to acuity scheduling/i.test(
				bodyText,
			)
		) {
			throw new Error('The saved browser session opened an Acuity or Squarespace login page.')
		}
		await waitForEditor(page, timeoutMs)
		console.log(
			`Verified authenticated Acuity storage state from ${storageStatePath} (${state.cookies.length} cookies).`,
		)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		const pageContext = page
			? ` Current URL: ${safePageUrl(page.url())}. Page title: ${await page.title().catch(() => 'unavailable')}.`
			: ''
		throw new Error(
			`Acuity storage state from ${storageStatePath} is expired or not authenticated.${pageContext} ${message}`,
		)
	} finally {
		await browser.close().catch(() => undefined)
	}
}

async function main() {
	const requireFresh = process.argv.includes('--require-fresh')
	const storageStatePath =
		process.argv.slice(2).find(argument => !argument.startsWith('--')) ||
		defaultStorageStatePath

	if (requireFresh) {
		requireFreshCapture(
			process.env.ACUITY_FULL_STORAGE_STATE_FILE || defaultFullStorageStatePath,
			positiveInteger(
				process.env.ACUITY_CAPTURE_MAX_AGE_MS,
				defaultFreshCaptureMaxAgeMs,
			),
		)
	}

	await verifyStorageState({ storageStatePath })
}

if (require.main === module) {
	main().catch(error => fail(error instanceof Error ? error.message : String(error)))
}

module.exports = {
	readStorageState,
	requireFreshCapture,
	safePageUrl,
	verifyStorageState,
}
