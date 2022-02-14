import test, { expect, Locator, Page } from '@playwright/test';

export class CheckoutPage {
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
    this.californaiExciseTax = this.page
      .locator('text=California Exise Tax:')
      .evaluate((el) => el.nextElementSibling);
    this.countyGrossTax = this.page
      .locator('text=County Gross Tax:')
      .evaluate((el) => el.nextElementSibling);
    this.countyGrossTax = this.page
      .locator('text=Sales:')
      .evaluate((el) => el.nextElementSibling);
  }

  async confirmOrderDetail(orderInfo: any = null) {}
}
