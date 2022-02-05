import { expect, Locator, Page } from '@playwright/test';
import { faker } from '@faker-js/faker';

export class CheckoutPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly phoneInput: Locator;
  readonly addressLine1: Locator;
  readonly city: Locator;
  readonly zipCodeInput: Locator;
  readonly comments: Locator;
  readonly lineItemPrices: any[];
  readonly lineItemNames: string[];
  readonly subTotal: Locator;
  readonly grossTaxAmount: Locator;
  readonly exciseTaxAmount: Locator;
  readonly salesTaxAmount: Locator;
  readonly cartTotalAmount: Locator;
  readonly placeOrderButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = this.page.locator('input[name="billing_first_name"]');
    this.lastNameInput = this.page.locator('input[name="billing_last_name"]');
    this.phoneInput = this.page.locator('input[name="billing_phone"]');
    this.addressLine1 = this.page.locator('input[name="billing_address_1"]');
    this.city = this.page.locator('input[name="billing_city"]');
    this.zipCodeInput = this.page.locator('input[name="billing_postcode"]');
    this.comments = this.page.locator('textarea[name="order_comments"]');
    this.placeOrderButton = this.page.locator('text=Place order');
  }

  async confirmCheckout(zipcode: string): Promise<string[]> {
    // Click input[name="billing_first_name"]
    await this.firstNameInput.click();
    await this.firstNameInput.fill(faker.name.firstName());

    // Fill input[name="billing_first_name"]
    await this.lastNameInput.click();
    await this.lastNameInput.fill(faker.name.lastName());

    // Click [placeholder="House\ number\ and\ street\ name"]
    await this.addressLine1.click();
    await this.addressLine1.fill(faker.address.streetAddress());

    // Click input[name="billing_city"]
    await this.city.click();
    await this.city.fill(faker.address.cityName());

    // Click input[name="billing_zipcode"]
    await this.zipCodeInput.click();
    await this.zipCodeInput.fill(zipcode);

    // Click input[name="billing_phone"]
    await this.phoneInput.click();
    await this.phoneInput.fill(faker.phone.phoneNumber());

    // Click textarea[name="order_comments"]
    await this.comments.click();
    await this.comments.fill(faker.random.randomWords(30));

    await this.placeOrderButton.click();
    return ['string', 'string'];
  }
}
