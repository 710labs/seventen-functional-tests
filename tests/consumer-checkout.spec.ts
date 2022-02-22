import { test, expect, devices } from '@playwright/test';
import { ListPasswordPage } from '../models/list-password-protect-page';
import { AgeGatePage } from '../models/age-gate-page';
import { LoginPage } from '../models/login-page';
import { ShopPage } from '../models/shop-page';
import { CreateAccountPage } from '../models/create-account-page';
import { v4 as uuidv4 } from 'uuid';
import { CheckoutPage } from '../models/checkout-page';
import { CartPage } from '../models/cart-page';

test.describe('Recreational Exisitng Consumer Checkout Tests', () => {
  const zipcodes = ['95376'];
  test.beforeEach(async ({ page, browserName }, workerInfo) => {
    const email = `test+${uuidv4()}@710labs.com`;
    const ageGatePage = new AgeGatePage(page);
    const listPassword = new ListPasswordPage(page);
    const createAccountPage = new CreateAccountPage(page);
    const loginPage = new LoginPage(page);
    const shopPage = new ShopPage(page, browserName, workerInfo);
    await ageGatePage.passAgeGate();
    await listPassword.submitPassword('qatester');
    await createAccountPage.create(email, 'test1234!', '95376', 0, true);
    await loginPage.login(email, 'test1234!');
    await listPassword.submitPassword('qatester');
    await shopPage.addProductsToCart(6);
  });
  zipcodes.forEach((zipcode) => {
    test(`Checkout Existing Customer Zipcode:${zipcode} `, async ({
      page,
      browserName,
    }, workerInfo) => {
      // test.skip(
      //   workerInfo.project.name === 'mobile-safari',
      //   'Browser Specific Issues'
      // );
      const cartPage = new CartPage(page, browserName, workerInfo);
      var cartTotals = await cartPage.verifyCart(zipcode);
      const checkOutPage = new CheckoutPage(page);
      await checkOutPage.confirmCheckout(zipcode, cartTotals);
    });
  });
});

test.describe('Recreational New Consumer Checkout Tests', () => {
  const zipcodes = ['95376'];
  test.beforeEach(async ({ page, browserName }, workerInfo) => {
    const ageGatePage = new AgeGatePage(page);
    const listPassword = new ListPasswordPage(page);
    const createAccountPage = new CreateAccountPage(page);
    const shopPage = new ShopPage(page, browserName, workerInfo);

    await ageGatePage.passAgeGate();
    await listPassword.submitPassword('qatester');
    await createAccountPage.create(
      `test+${uuidv4()}@710labs.com`,
      'test1234!',
      '95376',
      0
    );
    await shopPage.addProductsToCart(8);
  });
  zipcodes.forEach((zipcode) => {
    test(`Checkout New Customer Zipcode:${zipcode}`, async ({
      page,
      browserName,
    }, workerInfo) => {
      // test.skip(
      //   workerInfo.project.name === 'mobile-safari',
      //   'Browser Specific Issues'
      // );
      const cartPage = new CartPage(page, browserName, workerInfo);
      var cartTotals = await cartPage.verifyCart(zipcode);
      const checkOutPage = new CheckoutPage(page);
      await checkOutPage.confirmCheckout(zipcode, cartTotals);
    });
  });
});
