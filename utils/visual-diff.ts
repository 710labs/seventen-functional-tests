import { Locator, Page, expect } from "@playwright/test";

export async function visualDiff(page: Page, fileName: string, maxDiffValue: number) {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });
    await expect(page).toHaveScreenshot(fileName, { maxDiffPixels: maxDiffValue },);
}
export async function visualDiffWithMask(page: Page, fileName: string, maxDiffValue: number, maskLocator: Locator) {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });
    await expect(page).toHaveScreenshot(fileName, { maxDiffPixels: maxDiffValue, mask: [maskLocator] },);
}
export async function visualDiffWithMaskArray(page: Page, fileName: string, maxDiffValue: number, maskLocator: Locator[]) {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });
    await expect(page).toHaveScreenshot(fileName, { maxDiffPixels: maxDiffValue, mask: maskLocator },);
}