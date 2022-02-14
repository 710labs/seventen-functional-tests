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
    //Calculate Tax Rate Using Custom Api's + Tax Calculation Form
    //Look up tax class by productName, productId, or productSku via https://dev.710labs.com/wp-content/plugins/seventen-info-interface/products/?productName=Pielatti<br> (Living Soil)
    //Look up tax rates by zipCode ${baseURI}wp-content/plugins/seventen-info-interface/rates/?postCode=${postCode}`
    //Calculate tax total and total price for each item.
    //Add up total Excise, Gross, and Sales for Cart
    //Return Entire Object and parse through it in testCase.
    //inputJsonString
    //"{\n  \"rates\": {\n    \"amuse_lax1\": {\n      \"recreational\": {\n        \"grossRate\": 0.05,\n        \"exciseRate\": 0.15,\n        \"salesRate\": 0.095\n      },\n      \"medical\": {\n        \"grossRate\": 0.05,\n        \"exciseRate\": 0.15,\n        \"salesRate\": 0.095\n      },\n      \"mmic\": {\n        \"grossRate\": 0.05,\n        \"exciseRate\": 0.15,\n        \"salesRate\": 0\n      }\n    },\n    \"nxtlvl_oak1\": {\n      \"recreational\": {\n        \"grossRate\": 0.065,\n        \"exciseRate\": 0.15,\n        \"salesRate\": 0.0925\n      },\n      \"medical\": {\n        \"grossRate\": 0.05,\n        \"exciseRate\": 0.15,\n        \"salesRate\": 0.0925\n      },\n      \"mmic\": {\n        \"grossRate\": 0.05,\n        \"exciseRate\": 0.15,\n        \"salesRate\": 0\n      }\n    }\n  },\n  \"lineItems\": [\n    {\n      \"name\": \"Lemon Tree - 10-Pack Joints\",\n      \"total\": 300\n    },\n    {\n      \"name\": \"Lemon Tree - 10-Pack Joints\",\n      \"total\": 60\n    }\n  ]\n}"
  }
  async confirmCheckout(zipcode: string, cartTotals: any) {
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

    await test.step('Submit New Customer Form', async () => {
      await this.placeOrderButton.click();
      return ['string', 'string'];
    });
  }
}
