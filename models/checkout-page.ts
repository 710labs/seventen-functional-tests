import test, { expect, Locator, Page } from '@playwright/test';
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
  readonly lineItems: any;
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
    this.lineItems = this.page
      .locator('*css=tr >> .cart_item')
      .elementHandles();
  }

  async calculateTaxTotals(ApizipCode: string, productSubTotals: any) {
    //Create Shared Logic for calculating tax totals +use here. Use cart-page.ts for reference.
  }
  async confirmCheckout(zipcode: string, cartTotals: any): Promise<any> {
    await test.step('Fill in First Name', async () => {
      await this.firstNameInput.click();
      await this.firstNameInput.fill(faker.name.firstName());
    });

    await test.step('Fill in Last Name', async () => {
      await this.lastNameInput.click();
      await this.lastNameInput.fill(faker.name.lastName());
    });

    await test.step('Fill in Street Address', async () => {
      await this.addressLine1.click();
      await this.addressLine1.fill(faker.address.streetAddress());
    });

    await test.step('Fill in State', async () => {
      await this.city.click();
      await this.city.fill(faker.address.cityName());
    });

    await test.step('Fill in ZipCode', async () => {
      await this.zipCodeInput.click();
      await this.zipCodeInput.fill(zipcode);
    });

    await test.step('Fill in Phone Number', async () => {
      await this.phoneInput.click();
      await this.phoneInput.fill('123-456-7890');
    });

    await test.step('Fill in Order Notes', async () => {
      await this.comments.click();
      await this.comments.fill(faker.random.randomWords(30));
    });

    await test.step('Submit New Customer Order', async () => {
      await this.placeOrderButton.click();
    });
    return cartTotals;
  }
}
