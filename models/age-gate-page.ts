import test, { expect, Page } from '@playwright/test';

export class AgeGatePage {
  page: Page;
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async passAgeGate() {
    await test.step('Pass Age Gate', async () => {
      await this.page.goto('/');
      await this.page.click("text=I'm over 21 or a qualified patient");
      const passwordField = await this.page.locator(
        'input[name="post_password"]'
      );
      await passwordField.click();
    });
  }

  async failAgeGate() {
    await test.step('Fail Age Gate', async () => {
      await this.page.goto('/');
      await this.page.click("text=I'm not 21 yet or don't qualify");
      await expect(this.page.locator('.age-gate-error-message')).toHaveText(
        'You are not old enough to view this content'
      );
    });
  }
}
module.exports = { AgeGatePage };
