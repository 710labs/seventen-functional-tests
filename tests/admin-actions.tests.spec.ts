import { test, expect } from '@playwright/test';
import { ListPasswordPage } from '../models/list-password-protect-page';
import { AgeGatePage } from '../models/age-gate-page';
import { LoginPage } from '../models/login-page';
import { ShopPage } from '../models/shop-page';
import { CreateAccountPage } from '../models/create-account-page';
import { v4 as uuidv4 } from 'uuid';
import { CheckoutPage } from '../models/checkout-page';
import { CartPage } from '../models/cart-page';

test.describe('Admin Split Order', () => {
  const zipCode = '95376';
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
      zipCode,
      0
    );
    await shopPage.addProductsToCart(8);
  });
  test.skip(`User Can Split Order`, async ({ page, browserName }, workerInfo) => {
    const cartPage = new CartPage(page, browserName, workerInfo);
    var cartTotals = await cartPage.verifyCart(zipCode);
    await expect(page).toHaveURL('/checkout/');
    const checkOutPage = new CheckoutPage(page);
    await checkOutPage.confirmCheckout(zipCode, cartTotals);
  });
});
