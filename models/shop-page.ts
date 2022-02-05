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
    // Click [aria-label="Add\ “Old\ Family\ Purple”\ to\ your\ cart"]
    // const buttons = await this.page.locator('[aria-label*="to\\ your\\ cart"]');

    // for (let i = 0; i < itemCount - 1; i++) {
    //   await buttons[i].click();
    // }

    // Click [aria-label="Add\ “Grape\ Pie”\ to\ your\ cart"]
    await this.page.click(
      '[aria-label="Add\\ “Grape\\ Pie”\\ to\\ your\\ cart"]'
    );

    // Click text=my bag (2)
    await this.page.click(`text=my bag (${itemCount})`);
    await expect(this.page).toHaveURL('https://staging.710labs.com/cart/');
  }
}
