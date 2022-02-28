import test, { expect, Locator, Page } from '@playwright/test';

export class OrderReceivedPage {
  readonly page: Page;
  readonly orderNumber: Locator;
  readonly orderDate: Locator;
  readonly productLinks: any[];
  readonly subTotal: Locator;
  readonly countyGrossTax: any;
  readonly californaiExciseTax: any;
  readonly salesTax: any;
  readonly total: Locator;

  constructor(page: Page) {
    this.page = page;
    this.total = this.page.locator(
      '.woocommerce-order-overview__total >> strong'
    );
    this.orderNumber = this.page.locator(
      '.woocommerce-order-overview__order >> strong'
    );
  }

  async confirmOrderDetail(orderInfo: any = null): Promise<any> {
    var orderNumber;
    await test.step('Verify Order Recieved Totals', async () => {
      orderNumber = await this.orderNumber.innerText();
      await expect(this.page.url()).toContain('order-received');
      await this.page.waitForSelector(
        '.woocommerce-order-overview__total >> strong'
      );
      var actualTotal = await this.total.innerText();
      actualTotal = actualTotal.replace(/,/g, '');
      actualTotal = actualTotal.replace(/$/g, '');

      console.log(actualTotal);

      // await expect(parseFloat(actualTotal)).toBeCloseTo(
      //   parseFloat(orderInfo.total),
      //   1
      // );
    });
    return orderNumber;
  }
}
