// ⚠️ AI-GENERATED SCRIPT — Review before running in production  

import { browser } from 'k6/browser';  
import { group as k6group, check } from 'k6';  

// ── Async-compatible group wrapper ────────────────────────────────────────────  
// k6's group() is sync-only; this wrapper captures the returned Promise  
// so metrics are still recorded while async/await works correctly.  
function group(name, fn) {  
  let result;  
  k6group(name, () => { result = fn(); });  
  return result;  
}  

// ── Screenshot helper ─────────────────────────────────────────────────────────  
// Unique filename per VU and iteration to prevent overwrites  
function ss(step) {  
  return `vu${__VU}-iter${__ITER}-${step}.png`;  
}  

// ── Options ───────────────────────────────────────────────────────────────────  
export const options = {  
  scenarios: {  
    create_account: {  
      executor: 'ramping-vus',  
      options: {  
        browser: { type: 'chromium' },  
      },  
      stages: [  
        { duration: '2m', target: 10 },  
        { duration: '5m', target: 10 },  
        { duration: '2m', target: 0  },  
      ],  
    },  
  },  
  thresholds: {  
    'browser_web_vital_lcp': ['p(75) < 5000'],  
    'browser_web_vital_fid': ['p(75) < 300'],  
    'browser_web_vital_cls': ['p(75) < 0.25'],  
  },  
  cloud: {  
    projectID: 7152340,  
    distribution: {  
      'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 },  
    },  
  },  
};  

// ── Data helpers ──────────────────────────────────────────────────────────────  
const FIRST_NAMES = [  
  'LoadTest_James','LoadTest_John','LoadTest_Robert','LoadTest_Michael',  
  'LoadTest_William','LoadTest_David','LoadTest_Richard','LoadTest_Joseph',  
  'LoadTest_Charles','LoadTest_Thomas','LoadTest_Christopher','LoadTest_Daniel',  
  'LoadTest_Matthew','LoadTest_Anthony','LoadTest_Donald','LoadTest_Mark',  
  'LoadTest_Paul','LoadTest_Steven','LoadTest_Andrew','LoadTest_Kenneth',  
  'LoadTest_Joshua','LoadTest_Kevin','LoadTest_Brian','LoadTest_George',  
  'LoadTest_Edward','LoadTest_Ronald','LoadTest_Timothy','LoadTest_Jason',  
  'LoadTest_Jeffrey','LoadTest_Ryan','LoadTest_Lisa','LoadTest_Mary',  
  'LoadTest_Karen','LoadTest_Patricia','LoadTest_Sandra','LoadTest_Kimberly',  
  'LoadTest_Donna','LoadTest_Michelle','LoadTest_Elizabeth','LoadTest_Susan',  
  'LoadTest_Jessica','LoadTest_Sarah','LoadTest_Nancy','LoadTest_Jennifer',  
  'LoadTest_Maria','LoadTest_Melissa','LoadTest_Emily','LoadTest_Amanda',  
  'LoadTest_Hannah','LoadTest_Ashley',  
];  

const LAST_NAMES = [  
  'LoadTest_Smith','LoadTest_Johnson','LoadTest_Williams','LoadTest_Brown',  
  'LoadTest_Jones','LoadTest_Garcia','LoadTest_Miller','LoadTest_Davis',  
  'LoadTest_Rodriguez','LoadTest_Martinez','LoadTest_Hernandez','LoadTest_Lopez',  
  'LoadTest_Gonzalez','LoadTest_Wilson','LoadTest_Anderson','LoadTest_Thomas',  
  'LoadTest_Taylor','LoadTest_Moore','LoadTest_Jackson','LoadTest_Martin',  
  'LoadTest_Lee','LoadTest_Perez','LoadTest_Thompson','LoadTest_White',  
  'LoadTest_Harris','LoadTest_Sanchez','LoadTest_Clark','LoadTest_Ramirez',  
  'LoadTest_Lewis','LoadTest_Robinson','LoadTest_Walker','LoadTest_Young',  
  'LoadTest_Allen','LoadTest_King','LoadTest_Wright','LoadTest_Scott',  
  'LoadTest_Torres','LoadTest_Nguyen','LoadTest_Hill','LoadTest_Flores',  
  'LoadTest_Green','LoadTest_Adams','LoadTest_Nelson','LoadTest_Baker',  
  'LoadTest_Hall','LoadTest_Rivera','LoadTest_Campbell','LoadTest_Mitchell',  
  'LoadTest_Carter','LoadTest_Roberts',  
];  

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }  
function randomNumber() { return Math.floor(Math.random() * 900000) + 100000; }  
function randomPhone() {  
  return `555-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}-${String(Math.floor(Math.random()*10000)).padStart(4,'0')}`;  
}  

// ── Main VU function ──────────────────────────────────────────────────────────  
export default async function () {  
  const target      = __ENV.TARGET       || 'https://thelist-dev.710labs.com';  
  const password    = __ENV.LIST_PASSWORD;  

  const firstName   = pick(FIRST_NAMES);  
  const lastName    = pick(LAST_NAMES);  
  const email       = `loadtest-${firstName.toLowerCase()}.${lastName.toLowerCase()}.${randomNumber()}@loadtest.com`;  
  const usageType   = Math.random() < 0.5 ? 'Medical' : 'Recreational';  
  const fulfillment = Math.random() < 0.5 ? 'Pickup' : 'Delivery';  
  const itemCount   = 3;  
  const nextYear    = new Date().getFullYear() + 1;  

  // Fix: parse hostname without URL API (not available in k6 runtime)  
  const hostname = target.replace(/^https?:\/\//, '').split('/')[0];  

  const context = await browser.newContext();  
  const page    = await context.newPage();  

  try {  
    // Inject VIP cookie before first navigation  
    await context.addCookies([{  
      name:   'vipChecker',  
      value:  '3',  
      domain: hostname,  
      path:   '/',  
    }]);  

    // ── 1. Age Gate ───────────────────────────────────────────────────────────  
    await group('Pass Age Gate', async () => {  
      await page.goto(target, { waitUntil: 'networkidle' });  
      await page.screenshot({ path: ss('01-age-gate-loaded') });  

      await page.getByRole('button', { name: "I'm over 21 or a qualified patient" })  
               .click({ timeout: 60000 });  
      await page.waitForNavigation();  
      await page.screenshot({ path: ss('02-age-gate-passed') });  
    });  

    // ── 2. List Password ──────────────────────────────────────────────────────  
    await group('Enter List Password', async () => {  
      const pwd = page.locator('input[name="post_password"]');  
      await pwd.waitFor({ state: 'visible' });  
      await page.screenshot({ path: ss('03-password-form') });  

      await pwd.fill(password);  
      await page.locator('text=enter site').click();  
      await page.waitForNavigation();  
      await page.screenshot({ path: ss('04-after-login') });  
    });  

    // ── 3. Create Account ─────────────────────────────────────────────────────  
    await group('Create Account', async () => {  

      await group('Enter Account Info', async () => {  
        await page.locator('text=create an account').click();  
        await page.waitForNavigation();  
        await page.screenshot({ path: ss('05-register-page') });  

        await page.locator('input[name="svntn_core_registration_firstname"]').fill(firstName);  
        await page.locator('input[name="svntn_core_registration_lastname"]').fill(lastName);  
        await page.locator('input[name="email"]').fill(email);  
        await page.locator('input[name="password"]').fill(email);  

        await page.locator('select[name="svntn_core_dob_month"]').selectOption('12');  
        await page.locator('select[name="svntn_core_dob_day"]').selectOption('16');  
        await page.locator('select[name="svntn_core_dob_year"]').selectOption('1988');  

        const addr = page.locator('input[name="billing_address_1"]');  
        await addr.fill('3377 S La Cienega Blvd, Los Angeles, CA 90016');  
        await page.waitForTimeout(1000);  
        await page.keyboard.press('ArrowDown');  
        await page.keyboard.press('Enter');  

        await page.locator('input[name="billing_phone"]').fill(randomPhone());  
        await page.screenshot({ path: ss('06-account-info-filled') });  

        await page.waitForTimeout(2000);  
        await page.locator('button:has-text("Next")').click();  
        await page.waitForTimeout(1000);  
        await page.screenshot({ path: ss('07-after-next') });  
      });  

      await group('Upload Drivers License', async () => {  
        const dlInput = page.locator('input[name="svntn_core_personal_doc"]');  
        await dlInput.waitFor({ state: 'attached' });  
        await page.screenshot({ path: ss('08-dl-upload-form') });  

        await dlInput.setInputFiles('CA-DL.jpg');  
        await page.waitForTimeout(5000);  
        await page.screenshot({ path: ss('09-dl-uploaded') });  

        await page.locator('select[name="svntn_core_pxp_month"]').waitFor({ state: 'visible' });  
        await page.locator('select[name="svntn_core_pxp_month"]').selectOption('12');  
        await page.locator('select[name="svntn_core_pxp_day"]').selectOption('16');  
        await page.locator('select[name="svntn_core_pxp_year"]').selectOption(`${nextYear}`);  
        await page.screenshot({ path: ss('10-dl-expiry-set') });  
      });  

      await group('Submit Registration', async () => {  
        await page.getByRole('button', { name: 'Register' }).click();  
        await page.waitForTimeout(5000);  
        await page.screenshot({ path: ss('11-after-register') });  
      });  

      await group('Select Fulfillment Type', async () => {  
        await page.screenshot({ path: ss('12-fulfillment-choice') });  
        await page.locator('#fulfillmentElement').getByText(fulfillment, { exact: true }).click();  
        await page.screenshot({ path: ss('13-fulfillment-selected') });  
        await page.getByRole('button', { name: 'Submit' }).click();  
        await page.waitForNavigation();  
        await page.screenshot({ path: ss('14-after-fulfillment-submit') });  
      });  
    });  

    // ── 4. Create Cart ────────────────────────────────────────────────────────  
    await group('Create Cart', async () => {  

      await group('Add Items To Cart', async () => {  
        await page.waitForTimeout(5000);  

        const selector = usageType === 'Recreational'  
          ? '//li[contains(@class,"product") and not(contains(@class,"product_cat-woo-import-test")) and not(.//h2[contains(@class,"woocommerce-loop-product__title") and .//span[contains(@class,"medOnly")]])]//a[contains(@aria-label,"Add to cart:")]'  
          : '//li[contains(@class,"product") and not(contains(@class,"product_cat-woo-import-test"))]//a[contains(@aria-label,"Add to cart:")]';  

        await page.locator(selector).first().waitFor({ state: 'visible' });  
        await page.waitForTimeout(5000);  
        await page.screenshot({ path: ss('15-product-listing') });  

        const buttons = page.locator(selector);  

        const indices = Array.from({ length: itemCount }, (_, i) => i);  
        for (let i = indices.length - 1; i > 0; i--) {  
          const j = Math.floor(Math.random() * (i + 1));  
          [indices[i], indices[j]] = [indices[j], indices[i]];  
        }  
        for (const idx of indices) {  
          await buttons.nth(idx).click({ force: true });  
          await page.waitForTimeout(2000);  
        }  
        await page.screenshot({ path: ss('16-items-added-to-cart') });  
      });  

      await group('Review Cart', async () => {  
        await page.locator('a.cart-contents').click();  
        await page.waitForNavigation();  
        await page.screenshot({ path: ss('17-cart-page') });  

        await page.locator('.checkout-button').click();  
        await page.waitForNavigation();  
        await page.screenshot({ path: ss('18-checkout-page') });  
      });  
    });  

    // ── 5. Checkout ───────────────────────────────────────────────────────────  
    await group('Checkout Cart', async () => {  

      await group('Select Acuity Slot', async () => {  
        await page.waitForTimeout(2000);  
        const errorMsg = page.locator('#datetimeError');  

        if (!(await errorMsg.isVisible())) {  
          await page.locator('#svntnAcuityDayChoices .acuityChoice')  
                    .first()  
                    .waitFor({ state: 'visible', timeout: 45000 });  
          await page.screenshot({ path: ss('19-acuity-day-choices') });  

          await page.locator('#svntnAcuityDayChoices .acuityChoice').first().click();  

          await page.locator('#svntnAcuityTimeChoices .acuityChoice')  
                    .first()  
                    .waitFor({ state: 'visible' });  
          await page.screenshot({ path: ss('20-acuity-time-choices') });  

          await page.locator('#svntnAcuityTimeChoices .acuityChoice').first().click();  
          await page.screenshot({ path: ss('21-acuity-slot-selected') });  
        } else {  
          await page.screenshot({ path: ss('19-acuity-error-visible') });  
        }  
      });  

      await group('Place Order', async () => {  
        const placeOrder = page.locator('#place_order');  
        await placeOrder.waitFor({ state: 'visible' });  
        await page.screenshot({ path: ss('22-before-place-order') });  

        await placeOrder.click();  
        await page.waitForNavigation({ timeout: 60000 });  
        await page.screenshot({ path: ss('23-order-complete') });  

        check(page, {  
          'order completed': (p) => p.url().includes('order-received'),  
        });  
      });  
    });  

  } catch (error) {  
    await page.screenshot({ path: ss('ERROR-failure-state') });  
    throw error;  

  } finally {  
    await page.screenshot({ path: ss('FINAL-state') });  
    await page.close();  
    await context.close();  
  }  
}  