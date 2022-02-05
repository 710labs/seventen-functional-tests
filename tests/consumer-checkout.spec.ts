import { test, expect } from '@playwright/test';
import { ListPasswordPage } from '../models/list-password-protect-page';
import { AgeGatePage } from '../models/age-gate-page';
import { LoginPage } from '../models/login-page';
import { ShopPage } from '../models/shop-page';
import { CreateAccountPage } from '../models/create-account-page';
import { v4 as uuidv4 } from 'uuid';
import { CheckoutPage } from '../models/checkout-page';

test.describe('Recreational Exisitng Consumer Checkout Tests', () => {
  const zipcodes = ['95376'];
  test.beforeEach(async ({ page }) => {
    const ageGatePage = new AgeGatePage(page);
    const listPassword = new ListPasswordPage(page);
    const loginPage = new LoginPage(page);
    const shopPage = new ShopPage(page);
    await ageGatePage.passAgeGate();
    await listPassword.submitPassword('qatester');
    await loginPage.login(
      'ladellerby+codegen-test-2@techsavagery.net',
      'test1234!'
    );
    await shopPage.addProductsToCart(1);
  });
  zipcodes.forEach((zipcode) => {
    test(`Checkout Existing Customer Zipcode:${zipcode} `, async ({ page }) => {
      await page.click('text=Proceed to checkout');
      await expect(page).toHaveURL('/checkout/');
      const checkOutPage = new CheckoutPage(page);
      await checkOutPage.confirmCheckout(zipcode);
    });
  });
});

test.describe('Recreational New Consumer Checkout Tests', () => {
  const zipcodes = ['95376'];
  test.beforeEach(async ({ page }) => {
    const ageGatePage = new AgeGatePage(page);
    const listPassword = new ListPasswordPage(page);
    const createAccountPage = new CreateAccountPage(page);
    const shopPage = new ShopPage(page);

    await ageGatePage.passAgeGate();
    await listPassword.submitPassword('qatester');
    await createAccountPage.create(
      `test+${uuidv4()}@710labs.com`,
      'test1234!',
      '95376',
      0
    );
    await shopPage.addProductsToCart(1);
  });
  zipcodes.forEach((zipcode) => {
    test(`Checkout Existing Customer Zipcode:${zipcode} `, async ({
      page,
    }) => {
      await page.click('text=Proceed to checkout');
      await expect(page).toHaveURL('/checkout/');
      const checkOutPage = new CheckoutPage(page);
      await checkOutPage.confirmCheckout(zipcode);
    });
  });
});
