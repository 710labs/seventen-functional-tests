import { test, type Page, type TestInfo } from '@playwright/test'

export const QUEUEIT_REASON = 'QueueIt active — checks deferred'

// QueueFront markers verified against the live pre-sale waiting room. A
// connector script/cookie on the storefront alone is not an active queue.
export async function isQueueItWaitingRoom(page: Page): Promise<boolean> {
	try {
		const queuePage = page.locator('body[data-pageid="before"], body[data-pageid="queue"]')
		return await queuePage.isVisible() &&
			await page.locator('meta#queue-it_log').count() > 0 &&
			await page.locator('#main').isVisible()
	} catch {
		return false
	}
}

export async function skipIfQueueIt(page: Page, info: TestInfo = test.info()) {
	if (await isQueueItWaitingRoom(page)) {
		info.annotations.push({ type: 'queueit', description: QUEUEIT_REASON })
		info.skip(true, QUEUEIT_REASON)
	}
}

export async function withQueueItDetection(page: Page, info: TestInfo, action: () => Promise<void>) {
	try {
		await action()
	} catch (error) {
		// Only an action timeout on a confirmed waiting room is deferred.
		// Assertions, API errors, and other failures retain their original result.
		if (error instanceof Error && error.name === 'TimeoutError') await skipIfQueueIt(page, info)
		throw error
	}
}
