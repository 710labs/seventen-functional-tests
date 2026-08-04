import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import path from 'path'
import { AgeGatePage } from '../../models/age-gate-page'
import { CreateAccountPage } from '../../models/create-account-page'
import { LiveNonProdAccountPage } from '../../models/always-on/live-nonprod-account-page'
import { LiveNonProdHomePageActions } from '../../models/always-on/live-nonprod-homepage-actions'
import { HomePageLogin } from '../../models/always-on/login-homepage'
import { ListPasswordPage } from '../../models/list-password-protect-page'

const { DRIVER_LICENSE_FILES, MED_CARD_FILES } = require('../../artillery/image-upload-fixtures') as {
	DRIVER_LICENSE_FILES: string[]
	MED_CARD_FILES: string[]
}

type Storefront = 'thelist' | 'live'
type UploadResult = {
	documentType: 'Photo ID' | 'Medical Card'
	filename: string
	storefront: Storefront
}

type LiveDocument = {
	documentType: UploadResult['documentType']
	drawerSelector: string
	editLinkSelector: string
	expirationInputSelector: string
	fileInputSelector: string
	summarySelector: string
}

type LiveDocumentResponse = {
	errors?: Record<string, string>
	message?: string
	outcome?: string
	success?: boolean
	successCloserize?: boolean
}

const storefront = (process.env.IMAGE_UPLOAD_STOREFRONT || 'thelist') as Storefront
const target = process.env.IMAGE_UPLOAD_TARGET ||
	(storefront === 'live'
		? 'https://live-dev.710labs.com'
		: 'https://thelist-dev.710labs.com')
const fixtureDirectory = path.resolve(__dirname, '../../artillery')
const liveAuthenticationAddress = '440 Rodeo Drive Beverly Hills'

const livePhotoId: LiveDocument = {
	documentType: 'Photo ID',
	drawerSelector: '.wpse-drawer:has(h2:has-text("Replace your ID on file"))',
	editLinkSelector: 'a.specific-link[data-module="iddoc"]',
	expirationInputSelector: 'input#doc_exp',
	fileInputSelector: 'input#fasd_doc',
	summarySelector:
		'div.wpse-account-component:has(header:has-text("Photo ID")) .wpse-document-meta p',
}

const liveMedicalCard: LiveDocument = {
	documentType: 'Medical Card',
	drawerSelector: '.wpse-drawer:has(h2:has-text("Replace your med card on file"))',
	editLinkSelector: 'a.specific-link[data-module="meddoc"]',
	expirationInputSelector: 'input#medcard_exp',
	fileInputSelector: 'input#fasd_medcard',
	summarySelector:
		'div.wpse-account-component:has(header:has-text("Medical card")) .wpse-document-meta p',
}

function requiredSecret(name: string) {
	const value = process.env[name]

	if (!value?.trim()) {
		throw new Error(`${name} is required for the ${storefront} image-upload check.`)
	}

	return value
}

function fixturePath(filename: string) {
	return path.join(fixtureDirectory, filename)
}

function fixtureContentType(filename: string) {
	const extension = path.extname(filename).toLowerCase()

	if (extension === '.heic') {
		return 'image/heic'
	}

	if (extension === '.png') {
		return 'image/png'
	}

	return 'image/jpeg'
}

async function attachSuccessfulUpload(
	page: Page,
	testInfo: TestInfo,
	result: UploadResult,
) {
	const attachmentPrefix = `${result.storefront} ${result.documentType} ${result.filename}`

	await testInfo.attach(`${attachmentPrefix} - uploaded fixture`, {
		contentType: fixtureContentType(result.filename),
		path: fixturePath(result.filename),
	})
	await testInfo.attach(`${attachmentPrefix} - success screenshot`, {
		body: await page.screenshot({ fullPage: true }),
		contentType: 'image/png',
	})
}

async function visibleLocator(locator: Locator) {
	const count = await locator.count()

	for (let index = 0; index < count; index += 1) {
		const candidate = locator.nth(index)

		if (await candidate.isVisible().catch(() => false)) {
			return candidate
		}
	}

	throw new Error(`No visible element matched ${locator}`)
}

async function runTheListUploadCheck(
	page: Page,
	testInfo: TestInfo,
	results: UploadResult[],
) {
	const ageGatePage = new AgeGatePage(page)
	const listPasswordPage = new ListPasswordPage(page)
	const createAccountPage = new CreateAccountPage(page)
	const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

	await ageGatePage.passAgeGate()
	await listPasswordPage.submitPassword(requiredSecret('IMAGE_UPLOAD_LIST_PASSWORD'))
	await createAccountPage.reachPersonalDocumentUpload({
		address: '3377 S La Cienega Blvd, Los Angeles, CA 90016',
		email: `playwright-image-upload-${uniqueSuffix}@test.com`,
		firstName: 'PlaywrightUpload',
		lastName: `Check${uniqueSuffix.replace(/\W/g, '').slice(-8)}`,
		password: `Upload-${uniqueSuffix}-Pass!`,
		state: 'CA',
		zipCode: '90016',
	})

	for (const filename of DRIVER_LICENSE_FILES) {
		await test.step(`The List Photo ID: ${filename}`, async () => {
			await createAccountPage.uploadPersonalDocumentFixture(fixturePath(filename))
			const result: UploadResult = {
				documentType: 'Photo ID',
				filename,
				storefront: 'thelist',
			}
			results.push(result)
			await attachSuccessfulUpload(page, testInfo, result)
		})
	}
}

async function registerLiveUser(page: Page) {
	const homePageLogin = new HomePageLogin(page)
	const homePageActions = new LiveNonProdHomePageActions(page)
	const uniqueSuffix = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`

	await homePageLogin.navigateToURL(page, target)
	await homePageActions.enterAddress(page, 'live', liveAuthenticationAddress)
	await homePageLogin.newTestverifyUserSignInModalAppears(page, target)
	await homePageActions.addSingleProductToCart(page)
	await homePageLogin.registerNewUser(
		page,
		`image-upload-${uniqueSuffix}`,
		requiredSecret('IMAGE_UPLOAD_LIVE_PASSWORD'),
	)
	await expect(homePageLogin.userPopUpContainer).toBeHidden({ timeout: 30000 })
	await homePageLogin.navigateToURL(page, target)
	await expect(homePageLogin.accountButtonNav).toBeVisible()
}

function waitForLiveDocumentResponse(page: Page) {
	return page.waitForResponse(
		async response => {
			if (
				response.request().method() !== 'POST' ||
				!response.url().includes('/wp-admin/admin-ajax.php')
			) {
				return false
			}

			const payload = await response.json().catch(() => null)
			return Boolean(
				payload &&
				(typeof payload.outcome === 'string' ||
					typeof payload.success === 'boolean' ||
					typeof payload.successCloserize === 'boolean' ||
					payload.errors),
			)
		},
		{ timeout: 30000 },
	)
}

function assertSuccessfulLiveResponse(
	payload: LiveDocumentResponse,
	documentType: string,
	filename: string,
) {
	const errors =
		payload.errors && Object.keys(payload.errors).length > 0 ? payload.errors : null
	const succeeded =
		payload.outcome === 'success' ||
		payload.success === true ||
		payload.successCloserize === true

	if (errors || !succeeded) {
		throw new Error(
			`${documentType} upload failed for ${filename}: ${JSON.stringify({
				errors,
				message: payload.message,
				outcome: payload.outcome,
				success: payload.success,
				successCloserize: payload.successCloserize,
			})}`,
		)
	}
}

async function uploadLiveDocument(
	page: Page,
	document: LiveDocument,
	filename: string,
	expirationDay: number,
) {
	const editLink = await visibleLocator(page.locator(document.editLinkSelector))
	await editLink.evaluate(element => (element as HTMLElement).click())

	const drawer = await visibleLocator(page.locator(document.drawerSelector))
	const fileInput = drawer.locator(document.fileInputSelector)
	const expirationInput = drawer.locator(document.expirationInputSelector)
	const expirationYear = new Date().getFullYear() + 1
	const day = String(expirationDay).padStart(2, '0')

	await fileInput.setInputFiles(fixturePath(filename))
	await expect
		.poll(() =>
			fileInput.evaluate(input =>
				input instanceof HTMLInputElement
					? Array.from(input.files || []).map(file => file.name)
					: [],
			),
		)
		.toContain(filename)
	await expirationInput.fill(`${expirationYear}-04-${day}`)

	if (document.documentType === 'Medical Card') {
		await drawer.locator('select#medcard_state').selectOption('CA')
		await drawer
			.locator('input#medcard_no')
			.fill(`${Math.floor(10000000 + Math.random() * 90000000)}`)
	}

	const responsePromise = waitForLiveDocumentResponse(page)
	await drawer
		.locator('.fasd-form-submit')
		.first()
		.evaluate(element => (element as HTMLElement).click())

	const response = await responsePromise
	const payload = (await response.json()) as LiveDocumentResponse
	assertSuccessfulLiveResponse(payload, document.documentType, filename)
	await expect(drawer).toBeHidden({ timeout: 30000 })
	await expect(page.locator(document.summarySelector)).toContainText(
		`04/${day}/${expirationYear}`,
	)
}

async function runLiveDocumentMatrix(
	page: Page,
	testInfo: TestInfo,
	results: UploadResult[],
	document: LiveDocument,
	filenames: string[],
	startDay: number,
) {
	for (let index = 0; index < filenames.length; index += 1) {
		const filename = filenames[index]

		await test.step(`Live ${document.documentType}: ${filename}`, async () => {
			await uploadLiveDocument(page, document, filename, startDay + index)
			const result: UploadResult = {
				documentType: document.documentType,
				filename,
				storefront: 'live',
			}
			results.push(result)
			await attachSuccessfulUpload(page, testInfo, result)
		})
	}
}

async function runLiveUploadCheck(
	page: Page,
	testInfo: TestInfo,
	results: UploadResult[],
) {
	await test.step('Register Live test account', async () => {
		await registerLiveUser(page)
	})

	const accountPage = new LiveNonProdAccountPage(page)
	await test.step('Open Live My Account', async () => {
		await accountPage.goToAccountPage()
	})

	await runLiveDocumentMatrix(
		page,
		testInfo,
		results,
		livePhotoId,
		DRIVER_LICENSE_FILES,
		10,
	)
	await runLiveDocumentMatrix(
		page,
		testInfo,
		results,
		liveMedicalCard,
		MED_CARD_FILES,
		20,
	)
}

test(`Storefront image uploads - ${storefront}`, async ({ page }, testInfo) => {
	const results: UploadResult[] = []

	testInfo.annotations.push(
		{ type: 'Storefront', description: storefront },
		{ type: 'Target', description: target },
	)

	if (storefront === 'live') {
		await runLiveUploadCheck(page, testInfo, results)
	} else {
		await runTheListUploadCheck(page, testInfo, results)
	}

	await testInfo.attach('upload-results.json', {
		body: Buffer.from(JSON.stringify(results, null, 2)),
		contentType: 'application/json',
	})

	expect(results).toHaveLength(storefront === 'live' ? 6 : 3)
})
