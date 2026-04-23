import { expect, test, type Page } from '@playwright/test'
import { ProductImporterPage } from '../../models/admin/product-importer-page'
import { resolveMenuUploadFixture } from '../../utils/admin-drop/menu-upload-fixtures'

const horizontalScrollStepPixels = 600
const maxHorizontalScrollPasses = 20

async function passAgeGateIfPresent(page: Page) {
	const ageGateChallenge = page.locator('.age-gate-challenge')
	const passButton = page.getByText("I'm over 21 or a qualified patient", { exact: true })
	const isVisible = await ageGateChallenge.first().isVisible({ timeout: 5000 }).catch(() => false)

	if (!isVisible) {
		return
	}

	await passButton.click()
	await ageGateChallenge.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
}

function normalizeComparableText(text: string) {
	return text
		.replace(/[‘’‛`]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase()
}

async function getNormalizedIframeTextSnapshot(page: Page) {
	const pageText = await page.evaluate(() => document.body.innerText || '')

	return normalizeComparableText(pageText)
}

async function advanceHorizontalScroll(page: Page) {
	return page.evaluate(stepPixels => {
		const scrollables = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(element => {
			const hasHorizontalOverflow = element.scrollWidth - element.clientWidth > 8
			const overflowX = window.getComputedStyle(element).overflowX

			return hasHorizontalOverflow && ['auto', 'scroll', 'overlay'].includes(overflowX)
		})
		const targets = scrollables.length
			? scrollables
			: [document.scrollingElement || document.documentElement].filter(
					(element): element is Element => Boolean(element),
			  )
		let didScroll = false

		for (const target of targets) {
			if (!(target instanceof HTMLElement)) {
				continue
			}

			const nextScrollLeft = Math.min(target.scrollLeft + stepPixels, target.scrollWidth - target.clientWidth)

			if (nextScrollLeft > target.scrollLeft) {
				target.scrollLeft = nextScrollLeft
				didScroll = true
			}
		}

		return didScroll
	}, horizontalScrollStepPixels)
}

async function findMissingProductNamesAcrossHorizontalScroll(page: Page, productNames: string[]) {
	const normalizedProductNames = productNames.map(productName => ({
		productName,
		normalizedProductName: normalizeComparableText(productName),
	}))
	const textSnapshots = [await getNormalizedIframeTextSnapshot(page)]
	let missingProductNames = normalizedProductNames
		.filter(({ normalizedProductName }) => !textSnapshots.some(snapshot => snapshot.includes(normalizedProductName)))
		.map(({ productName }) => productName)

	for (let pass = 0; pass < maxHorizontalScrollPasses && missingProductNames.length; pass += 1) {
		const didScroll = await advanceHorizontalScroll(page)

		if (!didScroll) {
			break
		}

		await page.waitForTimeout(250)
		textSnapshots.push(await getNormalizedIframeTextSnapshot(page))
		missingProductNames = normalizedProductNames
			.filter(({ normalizedProductName }) => !textSnapshots.some(snapshot => snapshot.includes(normalizedProductName)))
			.map(({ productName }) => productName)
	}

	return missingProductNames
}

test('Menu upload happy path', async ({ page, browser }, testInfo) => {
	const productImporterPage = new ProductImporterPage(page)
	const fixture = await resolveMenuUploadFixture()
	const iframeContext = await browser.newContext({
		baseURL: process.env.BASE_URL,
	})
	const iframePage = await iframeContext.newPage()

	await testInfo.attach('menu-upload-fixture-key', {
		body: fixture.fixtureKey,
		contentType: 'text/plain',
	})
	await testInfo.attach('menu-upload-expected-products', {
		body: fixture.expectedProductNames.join('\n'),
		contentType: 'text/plain',
	})

	try {
		const publishedProductsCleanupSummary = await productImporterPage.trashAllPublishedProducts()
		await testInfo.attach('published-products-reset-summary', {
			body: JSON.stringify(publishedProductsCleanupSummary, null, 2),
			contentType: 'application/json',
		})

		await productImporterPage.gotoImporter()
		await productImporterPage.uploadCsv(fixture.filePath)
		await productImporterPage.ensureUpdateExistingUnchecked()
		await productImporterPage.continueFromUpload()
		await productImporterPage.runImporterWithDefaultMapping()
		await productImporterPage.assertNoVisibleImportErrors()

		await expect
			.poll(
				async () => {
					await iframePage.goto('/iframe/', { waitUntil: 'networkidle' })
					await passAgeGateIfPresent(iframePage)
					return findMissingProductNamesAcrossHorizontalScroll(iframePage, fixture.expectedProductNames)
				},
				{
					timeout: 60 * 1000,
					message: `Expected iframe menu to show all uploaded products from fixture ${fixture.fixtureKey}`,
				},
			)
			.toEqual([])
	} finally {
		await iframeContext.close()
	}
})
