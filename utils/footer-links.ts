import { expect, Locator, Page } from '@playwright/test'

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/

function normalizePathname(pathname: string): string {
	if (!pathname) {
		return '/'
	}

	const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`

	return normalizedPathname.endsWith('/') ? normalizedPathname : `${normalizedPathname}/`
}

export function validateFooterHref(href: string, pageUrl: string, expectedPath: string): URL {
	if (!href) {
		throw new Error(`[footer] Missing href for ${expectedPath}.`)
	}

	const resolvedUrl = new URL(href, pageUrl)
	const normalizedActualPath = normalizePathname(resolvedUrl.pathname)
	const normalizedExpectedPath = normalizePathname(expectedPath)

	if (ABSOLUTE_URL_PATTERN.test(href)) {
		const pageOrigin = new URL(pageUrl).origin

		if (resolvedUrl.origin !== pageOrigin) {
			throw new Error(
				`[footer] Expected ${normalizedExpectedPath} link origin ${pageOrigin} but received ${resolvedUrl.origin}.`,
			)
		}
	}

	if (normalizedActualPath !== normalizedExpectedPath) {
		throw new Error(
			`[footer] Expected footer link path ${normalizedExpectedPath} but received ${normalizedActualPath}.`,
		)
	}

	return resolvedUrl
}

async function assertFooterLinkTarget(
	page: Page,
	locator: Locator,
	expectedPath: string,
	linkLabel: string,
) {
	await expect(locator, `[footer] ${linkLabel} link should be visible.`).toBeVisible()
	await expect(locator, `[footer] ${linkLabel} link should have an href.`).toHaveAttribute(
		'href',
		/.+/,
	)

	const href = await locator.getAttribute('href')

	expect(href, `[footer] ${linkLabel} link should have an href.`).toBeTruthy()
	validateFooterHref(href as string, page.url(), expectedPath)
}

export async function assertFooterLinks(page: Page): Promise<void> {
	await assertFooterLinkTarget(page, page.locator('.site-info > span > a'), '/terms-of-use', 'Terms')
	await assertFooterLinkTarget(
		page,
		page.locator('.site-info > a'),
		'/privacy-policy',
		'Privacy',
	)
}
