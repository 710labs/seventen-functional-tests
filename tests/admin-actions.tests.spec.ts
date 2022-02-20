import { test, expect } from '@playwright/test';
import { ListPasswordPage } from '../models/list-password-protect-page';
import { AgeGatePage } from '../models/age-gate-page';
import { LoginPage } from '../models/login-page';
import { ShopPage } from '../models/shop-page';
import { CreateAccountPage } from '../models/create-account-page';
import { v4 as uuidv4 } from 'uuid';
import { CheckoutPage } from '../models/checkout-page';
import { CartPage } from '../models/cart-page';
import { MyAccountPage } from '../models/my-account-page';
import { AdminLogin } from '../models/admin-login-page';
import { OrderReceivedPage } from '../models/order-recieved-page';
import { EditOrderPage } from '../models/edit-order-page';

test.describe('Admin Split Order', () => {
  const zipCode = '95376';
  const orderQuanity = 8;
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
    await shopPage.addProductsToCart(orderQuanity);
  });
  test(`User Can Split Order`, async ({ page, browserName }, workerInfo) => {
    const cartPage = new CartPage(page, browserName, workerInfo);
    const orderReceived = new OrderReceivedPage(page);
    const checkOutPage = new CheckoutPage(page);
    const myAccountPage = new MyAccountPage(page);
    const adminLoginPage = new AdminLogin(page);
    const editOrderPage = new EditOrderPage(page);
    var orderTotals;
    var orderNumber;

    var cartTotals = await cartPage.verifyCart(zipCode);
    await test.step('Verify Checkout Page Totals + Taxes', async () => {
      await expect(page).toHaveURL('/checkout/');
      orderTotals = await checkOutPage.confirmCheckout(zipCode, cartTotals);
    });

    await test.step('Comfirm Order Details on /order-received', async () => {
      orderNumber = await orderReceived.confirmOrderDetail(orderTotals);
    });

    await test.step('Logout Consumer', async () => {
      await myAccountPage.logout();
    });
    await test.step('Login Admin', async () => {
      await adminLoginPage.login();
    });
    await test.step('Admin Split Order', async () => {
      await editOrderPage.splitOrder(orderNumber, orderQuanity);
    });
  });
});
