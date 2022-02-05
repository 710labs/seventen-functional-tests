import { expect, Locator, Page } from '@playwright/test';

export class ShopPage {
  readonly page: Page;
  readonly addProductButtons;
  readonly passwordField: Locator;
  readonly lostPasswordLink: Locator;
  readonly rememberMeCheckBox: Locator;
  readonly loginButton: Locator;
  readonly createAccountLink: Locator;

  constructor(page: Page) {
    this.page = page;
  }

  async addProductsToCart(itemCount: number) {
    await this.page.click(
      '[aria-label="Add\\ “Grape\\ Pie”\\ to\\ your\\ cart"]'
    );
    await this.page.click(`text=my bag (${itemCount})`);
    await expect(this.page).toHaveURL('/cart/');
  }
}
