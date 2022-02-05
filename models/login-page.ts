import { expect, Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly userNameField: Locator;
  readonly passwordField: Locator;
  readonly lostPasswordLink: Locator;
  readonly rememberMeCheckBox: Locator;
  readonly loginButton: Locator;
  readonly createAccountLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userNameField = page.locator('#username');
    this.passwordField = page.locator('#password');
    this.lostPasswordLink = page.locator('.lost_password');
    this.rememberMeCheckBox = page.locator('#rememberme');
    this.loginButton = page.locator('[name="login"]');
  }

  async login(username: string, password: string) {
    // Click input[name="username"]
    await this.userNameField.click();

    // Fill input[name="username"]
    await this.userNameField.fill(username);

    // Click input[name="password"]
    await this.passwordField.click();

    // Fill input[name="password"]
    await this.passwordField.fill(password);

    // Click button:has-text("Login")
    await this.loginButton.click();
    await expect(this.page).toHaveURL('/');
  }
}
