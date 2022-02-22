import test, {
  Page,
  TestInfo,
  Locator,
  expect,
  request,
} from '@playwright/test';

export class CartPage {
  page: Page;
  browserName: any;
  workerInfo: TestInfo;
  checkoutButton: Locator;
  cartItems: any[];
  cartTotal: any;
  usageType: any;

  constructor(
    page: Page,
    browserName: any,
    workerInfo: TestInfo,
    usageType = 0
  ) {
    this.page = page;
    this.browserName = browserName;
    this.workerInfo = workerInfo;
    this.checkoutButton = this.page.locator('text=Proceed to checkout');
    this.cartItems = new Array();
    this.usageType = usageType;
  }
  async formatNumbers(value: string): Promise<string> {
    return value.replace(/(<([^>]+)>)/gi, '').replace(/\$|,/g, '');
  }

  async bankersRound(num) {
    return (Math.round(num * 100) / 100).toFixed(2);
  }
  async calculateCartTotals(taxRates: any, productItems: any[]): Promise<any> {
    var taxRate = await new Array();
    taxRate = await taxRates.rates.standard;
    var expectedCartTotal;
    var total = 0;
    var cartSubTotal = 0;
    var grossTaxAmount = 0;
    var exciseTaxAmount = 0;
    var salesTaxAmount = 0;
    var grossRate =
      taxRate.find((tax) => {
        return tax.label === 'County Gross Tax';
      }).rate / 100;
    var exciseRate =
      taxRate.find((tax) => {
        return tax.label === 'California Excise Tax';
      }).rate / 100;
    var salesRate =
      taxRate.find((tax) => {
        return tax.label === 'Sales';
      }).rate / 100;

    for (let i = 0; i < productItems.length; i++) {
      cartSubTotal += Number(productItems[i].subTota1);

      var grossTax = await this.bankersRound(
        Number(productItems[i].subTota1) * grossRate
      );
      grossTaxAmount += Number(grossTax);
      total = Number(grossTax) + Number(productItems[i].subTota1);

      var exciseTax = await this.bankersRound(total * exciseRate);
      total = Number(exciseTax) + total;
      exciseTaxAmount += Number(exciseTax);

      var salesTax = await this.bankersRound(total * salesRate);
      salesTaxAmount += Number(salesTax);
      total = grossTaxAmount + exciseTaxAmount + salesTaxAmount + cartSubTotal;
    }

    var expectedCartSubTotal = await this.bankersRound(cartSubTotal);
    var expectedGrossTaxAmount = await this.bankersRound(grossTaxAmount);
    var expectedExciseTaxAmount = await this.bankersRound(exciseTaxAmount);
    var expectedSalesTaxAmount = await this.bankersRound(salesTaxAmount);
    var expectedTotal = await this.bankersRound(total);

    expectedCartTotal = {
      expectedCartSubTotal,
      expectedGrossTaxAmount,
      expectedExciseTaxAmount,
      expectedSalesTaxAmount,
      expectedTotal,
    };
    console.log(expectedCartTotal);

    return expectedCartTotal;
  }
  async verifyCart(zipcode: string): Promise<any> {
    const apiContext = await request.newContext({
      baseURL: 'https://dev.710labs.com',
      extraHTTPHeaders: {
        'x-api-key': `${process.env.API_KEY}`,
      },
    });
    await test.step('Verify Cart Totals', async () => {
      //Get Tax Rates
      var taxRates: any;

      const taxRateResponse = await apiContext.get(
        `/wp-content/plugins/seventen-info-interface/rates/?postCode=${zipcode}`
      );
      const taxRateResponseBody: any = await taxRateResponse.json();

      taxRates = taxRateResponseBody;
      console.log(taxRates);

      //Get ProductItem info Info
      await this.page.waitForSelector('.cart_item');

      const productRows = await this.page
        .locator('.cart_item')
        .elementHandles();

      for (let i = 0; i < productRows.length; i++) {
        var unitPrice = await (
          await productRows[i].$('.product-price >> bdi')
        ).innerHTML();

        unitPrice = await this.formatNumbers(unitPrice);
        var quanity = await (await productRows[i].$('.qty')).inputValue();
        var amount = await this.formatNumbers(
          await (await productRows[i].$('.product-subtotal >> bdi')).innerHTML()
        );
        var name = await (
          await productRows[i].$('.product-name >> a')
        ).innerHTML();
        name = name.replace('#', '%23');
        const productInfoResponse = await apiContext.get(
          `/wp-content/plugins/seventen-info-interface/products/?productName=${name}`
        );
        const productInfoResponseBody: any = await productInfoResponse.json();

        var id = productInfoResponseBody.product.id;
        var sku = productInfoResponseBody.product.sku;
        var taxClass = productInfoResponseBody.product.taxClass;
        this.cartItems.push({
          id,
          name,
          sku,
          unitPrice,
          taxClass,
          quanity,
          subTota1: amount,
        });
      }
      //Get CartTotal object (actual cart)
      await this.page.waitForSelector('.shop_table');
      var cartSubTotal = await (
        await this.page.$('.shop_table >> .cart-subtotal >> bdi')
      ).innerHTML();
      cartSubTotal = await this.formatNumbers(cartSubTotal);

      var grossTaxAmount = await (
        await this.page.$('.tax-rate-us-ca-county-gross-tax-1 >> .amount')
      ).innerHTML();
      grossTaxAmount = await this.formatNumbers(grossTaxAmount);

      var exciseTaxAmount = await (
        await this.page.$('.tax-rate-us-ca-california-excise-tax-2 >> .amount')
      ).innerHTML();
      exciseTaxAmount = await this.formatNumbers(exciseTaxAmount);

      var salesTaxAmount = await (
        await this.page.$('.tax-rate-us-ca-sales-3 >> .amount')
      ).innerHTML();
      salesTaxAmount = await this.formatNumbers(salesTaxAmount);

      var total = await (
        await this.page.$('.shop_table >> .order-total >> .amount')
      ).innerHTML();
      total = await this.formatNumbers(total);

      this.cartTotal = {
        cartSubTotal,
        grossTaxAmount,
        exciseTaxAmount,
        salesTaxAmount,
        total,
      };
      console.log(this.cartTotal);

      var expectedCartTotal = await this.calculateCartTotals(
        taxRates,
        this.cartItems
      );
      await expect(this.cartTotal.total).toBe(expectedCartTotal.expectedTotal);
    });
    await test.step('Confirm Cart + Proceed to Checkout', async () => {
      this.checkoutButton.click();
    });
    return this.cartTotal;
  }
}
