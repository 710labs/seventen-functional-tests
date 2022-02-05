import { expect, Locator, Page } from '@playwright/test';

export class CreateAccountPage {
  readonly page: Page;
  readonly userNameField: Locator;
  readonly passwordField: Locator;
  readonly usageType: Locator;
  readonly zipCode: Locator;
  readonly birthMonth: Locator;
  readonly birthDay: Locator;
  readonly birthYear: Locator;
  readonly driversLicenseUpload: Locator;
  readonly medicalCardUpload: Locator;
  readonly lostPasswordLink: Locator;
  readonly rememberMeCheckBox: Locator;
  readonly loginButton: Locator;
  readonly createAccountLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userNameField = page.locator('input[name="email"]');
    this.passwordField = page.locator('input[name="password"]');
    this.usageType = page.locator('input[name="svntn_last_usage_type"]');
    this.zipCode = page.locator('input[name="svntn_core_registration_zip"]')
    this.birthMonth = page.locator('select[name="date_\\[month\\]"]');
    this.birthDay = page.locator('select[name="date_\\[day\\]"]');
    this.birthYear = page.locator('select[name="date_\\[year\\]"]');
    this.driversLicenseUpload = page.locator('#wccf_user_field_drivers_license');
    this.medicalCardUpload = page.locator('#wccf_user_field_medical_card')
  }

  async create(
    username: string,
    password: string,
    zipcode: string,
    type: number
  ) {
    await this.page.click('text=create an account');
    await expect(this.page).toHaveURL('/register/');

    // Fill input[name="email"]
    await this.userNameField.click();
    await this.userNameField.fill(username);

    // Fill input[name="password"]
    await this.passwordField.click();
    await this.passwordField.fill(password);

    // Fill input[name="svntn_last_usage_type"]
    await this.page.locator(`input[name="svntn_last_usage_type"] >> nth=${type}`).check();

    // Click input[name="svntn_core_registration_zip"]
    await this.zipCode.click();
    await this.zipCode.fill(zipcode);

    // Select 12
    await this.birthMonth.selectOption('12');

    // Select 16
    await this.birthDay.selectOption('16');

    // Select 1988
    await this.birthYear.selectOption('1988');

    // Upload CA-DL.jpg
    const dlUploadButton = await this.page.waitForSelector(
      '#wccf_user_field_drivers_license'
    );
    const [driversLicenseChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      dlUploadButton.click(),
    ]);
    await driversLicenseChooser.setFiles('CA-DL.jpg');
    await driversLicenseChooser.page();

    // Upload Sample-Medical-Marijuana-Card-PA-1.png
    const medicalCardButton = await this.page.waitForSelector(
      '#wccf_user_field_medical_card'
    );
    const [medicalCardChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      medicalCardButton.click(),
    ]);
    await medicalCardChooser.setFiles('Medical-Card.png');
    await medicalCardChooser.page();

    // Click button:has-text("Register")
    await this.page.waitForTimeout(1000);
    await this.page.click('button:has-text("Register")');
    await this.page.waitForTimeout(1000);
  }
}
