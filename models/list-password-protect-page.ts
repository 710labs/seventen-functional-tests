import { Page, expect } from '@playwright/test';

export class ListPasswordPage {
  page: Page;
  /**
   * @param {import('playwright').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async submitPassword([password]: string) {
    // Click input[name="post_password"]
    await this.page.click('input[name="post_password"]');

    // Fill input[name="post_password"]
    await this.page.fill('input[name="post_password"]', 'qatester');

    // Press Enter
    await this.page.press('input[name="post_password"]', 'Enter');

    await expect(this.page).toHaveURL('/my-account/');
  }
}
module.exports = { ListPasswordPage };
