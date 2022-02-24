import test, { expect, Locator, Page, request } from '@playwright/test';
import { faker } from '@faker-js/faker';
import {
  calculateCartTotals,
  formatNumbers,
} from '../utils/order-calculations';

export class CheckoutPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly phoneInput: Locator;
  readonly addressLine1: Locator;
  readonly city: Locator;
  readonly zipCodeInput: Locator;
  readonly comments: Locator;
  readonly subTotal: Locator;
  readonly grossTaxAmount: Locator;
  readonly exciseTaxAmount: Locator;
  readonly salesTaxAmount: Locator;
  readonly cartTotalAmount: Locator;
  readonly placeOrderButton: Locator;
  cartItems: any;
  usageType: number;
  cartTotal: {
    cartSubTotal: string;
    grossTaxAmount: string;
    exciseTaxAmount: string;
    salesTaxAmount: string;
    total: string;
  };
  checkoutButton: any;
  taxRates: any;

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
    this.cartItems = new Array();
  }

  async verifyCheckoutTotals(zipcode: string, usageType: number): Promise<any> {
    const apiContext = await request.newContext({
      baseURL: 'https://dev.710labs.com',
      extraHTTPHeaders: {
        'x-api-key': `${process.env.API_KEY}`,
      },
    });
    await test.step('GET Tax Rates + Product Info', async () => {
      await test.step('GET Tax Rate', async () => {
        //Get Tax Rates

        const taxRateResponse = await apiContext.get(
          `/wp-content/plugins/seventen-info-interface/rates/?postCode=${zipcode}`
        );
        const taxRateResponseBody: any = await taxRateResponse.json();

        this.taxRates = taxRateResponseBody;
      });
      await test.step('GET Product Info', async () => {
        //Get ProductItem Info
        await this.page.waitForSelector('.cart_item');

        const productRows = await this.page
          .locator('.cart_item')
          .elementHandles();

        for (let i = 0; i < productRows.length; i++) {
          var subTotal = await formatNumbers(
            await (await productRows[i].$('.product-total >> bdi')).innerHTML()
          );
          var name = await (
            await productRows[i].$('.product-name')
          ).innerHTML();
          name = name.replace('#', '%23');
          await test.step('Call Product API Endpoint', async () => {
            const productInfoResponse = await apiContext.get(
              `/wp-content/plugins/seventen-info-interface/products/?productName=${name}`
            );
            const productInfoResponseBody: any =
              await productInfoResponse.json();

            var id = productInfoResponseBody.product.id;
            var sku = productInfoResponseBody.product.sku;
            var taxClass = productInfoResponseBody.product.taxClass;
            this.cartItems.push({
              id,
              name,
              sku,
              taxClass,
              subTotal,
            });
          });
        }
        //Get CartTotal object (actual cart)
        await this.page.waitForSelector('.shop_table');
        var cartSubTotal = await (
          await this.page.$('.shop_table >> .cart-subtotal >> bdi')
        ).innerHTML();
        cartSubTotal = await formatNumbers(cartSubTotal);
        if (usageType === 0) {
          var grossTaxAmount = await (
            await this.page.$('.tax-rate-us-ca-county-gross-tax-1 >> .amount')
          ).innerHTML();
          grossTaxAmount = await formatNumbers(grossTaxAmount);

          var exciseTaxAmount = await (
            await this.page.$(
              '.tax-rate-us-ca-california-excise-tax-2 >> .amount'
            )
          ).innerHTML();
          exciseTaxAmount = await formatNumbers(exciseTaxAmount);

          var salesTaxAmount = await (
            await this.page.$('.tax-rate-us-ca-sales-3 >> .amount')
          ).innerHTML();
          salesTaxAmount = await formatNumbers(salesTaxAmount);
        } else {
          var grossTaxAmount = await (
            await this.page.$('.tax-rate-us-ca-gross-1 >> .amount')
          ).innerHTML();
          grossTaxAmount = await formatNumbers(grossTaxAmount);

          var exciseTaxAmount = await (
            await this.page.$('.tax-rate-us-ca-excise-2 >> .amount')
          ).innerHTML();
          exciseTaxAmount = await formatNumbers(exciseTaxAmount);

          var salesTaxAmount = await (
            await this.page.$('.tax-rate-us-ca-sales-3 >> .amount')
          ).innerHTML();
          salesTaxAmount = await formatNumbers(salesTaxAmount);
        }

        var total = await (
          await this.page.$('.shop_table >> .order-total >> .amount')
        ).innerHTML();
        total = await formatNumbers(total);

        this.cartTotal = {
          cartSubTotal,
          grossTaxAmount,
          exciseTaxAmount,
          salesTaxAmount,
          total,
        };
        console.log(this.cartTotal);

        var expectedCartTotal = await calculateCartTotals(
          this.taxRates,
          this.cartItems,
          this.usageType
        );
        await expect(this.cartTotal.total).toBe(
          expectedCartTotal.expectedTotal
        );
      });
      await test.step('GET Actual Order Totals', async () => {
        //Get CartTotal object (actual cart)
        await this.page.waitForSelector('.shop_table');
        var cartSubTotal = await (
          await this.page.$('.shop_table >> .cart-subtotal >> bdi')
        ).innerHTML();
        cartSubTotal = await formatNumbers(cartSubTotal);
        if (usageType === 0) {
          await test.step('GET Recreational Tax Totals', async () => {
            var grossTaxAmount = await (
              await this.page.$('.tax-rate-us-ca-county-gross-tax-1 >> .amount')
            ).innerHTML();
            grossTaxAmount = await formatNumbers(grossTaxAmount);

            var exciseTaxAmount = await (
              await this.page.$(
                '.tax-rate-us-ca-california-excise-tax-2 >> .amount'
              )
            ).innerHTML();
            exciseTaxAmount = await formatNumbers(exciseTaxAmount);

            var salesTaxAmount = await (
              await this.page.$('.tax-rate-us-ca-sales-3 >> .amount')
            ).innerHTML();
            salesTaxAmount = await formatNumbers(salesTaxAmount);
            var total = await (
              await this.page.$('.shop_table >> .order-total >> .amount')
            ).innerHTML();
            total = await formatNumbers(total);

            this.cartTotal = {
              cartSubTotal,
              grossTaxAmount,
              exciseTaxAmount,
              salesTaxAmount,
              total,
            };
            console.log(this.cartTotal);
          });
        } else {
          await test.step('GET Medical Tax Totals', async () => {
            var grossTaxAmount = await (
              await this.page.$('.tax-rate-us-ca-gross-1 >> .amount')
            ).innerHTML();
            grossTaxAmount = await formatNumbers(grossTaxAmount);

            var exciseTaxAmount = await (
              await this.page.$('.tax-rate-us-ca-excise-2 >> .amount')
            ).innerHTML();
            exciseTaxAmount = await formatNumbers(exciseTaxAmount);

            var salesTaxAmount = await (
              await this.page.$('.tax-rate-us-ca-sales-3 >> .amount')
            ).innerHTML();
            salesTaxAmount = await formatNumbers(salesTaxAmount);
            var total = await (
              await this.page.$('.shop_table >> .order-total >> .amount')
            ).innerHTML();
            total = await formatNumbers(total);

            this.cartTotal = {
              cartSubTotal,
              grossTaxAmount,
              exciseTaxAmount,
              salesTaxAmount,
              total,
            };
            console.log(this.cartTotal);
          });
        }

        var expectedCartTotal = await calculateCartTotals(
          this.taxRates,
          this.cartItems,
          this.usageType
        );
        await expect(this.cartTotal.total).toBe(
          expectedCartTotal.expectedTotal
        );
      });
    });
    return this.cartTotal;
  }
  async confirmCheckout(zipcode: string, cartTotals: any, usageType:number): Promise<any> {
    const firstName = faker.name.firstName();
    const lastName = faker.name.lastName();
    await test.step('Fill in First Name', async () => {
      await this.firstNameInput.click();
      await this.firstNameInput.fill(firstName);
    });

    await test.step('Fill in Last Name', async () => {
      await this.lastNameInput.click();
      await this.lastNameInput.fill(lastName);
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

    await test.step('Verify Order Total', async () => {
      await this.verifyCheckoutTotals(zipcode, usageType);
    });

    await test.step('Submit New Customer Order', async () => {
      await this.placeOrderButton.click();
    });

    console.log({
      firstName,
      lastName,
    });

    return cartTotals;
  }
}
