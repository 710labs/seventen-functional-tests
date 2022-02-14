import test, { expect, Locator, Page } from '@playwright/test';

export class AdminLogin {
  readonly page: Page;
  readonly userNameField: Locator;
  readonly passwordField: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userNameField = page.locator('input[name="log"]');
    this.passwordField = page.locator('text=Addresses');
    this.loginButton = page.locator('text=Log In');
  }

  async login() {
    await test.step('Logout User', async () => {
      await this.page.goto('/wp-admin/');
      await this.userNameField.fill('ladellerby@techsavagery.net');
      await this.passwordField.fill('710noodledoink')
      await this.loginButton.click()
    });
  }
}
