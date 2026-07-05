# Duplication Report

This document catalogs the major duplication hotspots in the test suite and sketches concrete before/after consolidation patterns. Estimated savings are line-count reductions from merging, not deletions of test coverage.

---

## 1. State Smoke Tests (Highest ROI)

### Current State

Five near-identical files totaling ~404 lines:

| File | Lines | Usage | Fulfillment | Checkout |
|------|------:|-------|-------------|----------|
| `tests/smoke-tests/smoke-test-ca.spec.ts` | 76 | recreational | Delivery | `confirmCheckout()` |
| `tests/smoke-tests/smoke-test-co.spec.ts` | 80 | medical | Pickup | `confirmCheckout()` |
| `tests/smoke-tests/smoke-test-mi.spec.ts` | 95 | recreational | Pickup | **Manual** (goToCart → selectSlot → placeOrder) |
| `tests/smoke-tests/smoke-test-nj.spec.ts` | 79 | medical | Pickup | `confirmCheckout()` |
| `tests/smoke-tests/smoke-test-fl.spec.ts` | 74 | medical | Delivery | `confirmCheckout()` |

**~69% (~280 lines) are structurally identical** and differ only in parameter values.

### What Actually Differs

| Parameter | CA | CO | MI | NJ | FL |
|-----------|----|----|----|----|-----|
| `usageType` | recreational | medical | recreational | medical | medical |
| `fulfillment` | Delivery | Pickup | Pickup | Pickup | Delivery |
| `zipCode` | 90210 | random from `coloradoAddressess` | 48203 | 07901 | 32003 |
| `address` | Beverly Hills | Boulder | Detroit | Summit | Fleming Island |
| `accountMethod` | `create()` | `create()` | **`createMichiganCustomer()`** | `create()` | `create()` |
| `cartItemCount` | `getSmokeCartItemCount()` | same | same | same | **hardcoded `6`** |
| `checkoutMethod` | confirmCheckout | confirmCheckout | **manual** | confirmCheckout | confirmCheckout |
| `skipMobile` | false | true | true | true | true |
| `writeOrderIds` | both files | order_id only | order_id only | order_id only | order_id only |

### Proposed After

```typescript
// tests/smoke-tests/smoke-order.spec.ts
import { smokeStateConfigs } from '../../utils/smoke-state-configs'

for (const config of smokeStateConfigs) {
  test.describe(`Basic Acceptance Tests ${config.state}`, () => {
    test(`Basic Acceptance Test - ${config.usageLabel} @${config.usageTag} @${config.stateTag} @smoke`, async ({ page, ... }) => {
      test.skip(config.skipMobile && workerInfo.project.name === 'Mobile Chrome')

      await storefrontFixture.passGates(page)
      await storefrontFixture.enterPassword(page)
      await config.accountMethod(createAccountPage, fakeUser)
      await config.shopMethod(shopPage, config.cartItemCount)
      await config.checkoutMethod({ cartPage, checkOutPage, orderReceived })
      await assertOrderPlaced(orderReceived, testInfo)
    })
  })
}
```

```typescript
// utils/smoke-state-configs.ts
export const smokeStateConfigs = [
  {
    state: 'CA', stateTag: 'CA', usageType: 'recreational', usageTag: 'recreational',
    zipCode: '90210', address: '123 Rodeo Dr, Beverly Hills, CA 90210',
    fulfillment: 'Delivery', cartItemCount: getSmokeCartItemCount(),
    accountMethod: (page, user) => page.create(user, ...),
    checkoutMethod: 'confirmCheckout', skipMobile: false,
  },
  {
    state: 'MI', stateTag: 'MI', usageType: 'recreational', usageTag: 'recreational',
    zipCode: '48203', address: '123 Eight Mile Rd, Detroit, MI 48203',
    fulfillment: 'Pickup', cartItemCount: getSmokeCartItemCount(),
    accountMethod: (page, user) => page.createMichiganCustomer(...),
    checkoutMethod: 'manualMi', skipMobile: true,
  },
  // CO, NJ, FL ...
]
```

**Estimated savings:** ~280 lines removed; 5 files → 1 spec + 1 config module.

---

## 2. State E2E Order Tests

### Current State

| File | Lines | Test count | Matrix |
|------|------:|-----------|--------|
| `tests/e2e-tests/california-order.spec.ts` | 153 | 4 | existing/new × med/rec |
| `tests/e2e-tests/colorado-order.spec.ts` | 159 | 4 | same |
| `tests/e2e-tests/new-jersey-order.spec.ts` | 171 | 4 | same |
| `tests/e2e-tests/michigan-order.spec.ts` | 132 | 2 | new rec in-state / out-of-state only |
| `tests/e2e-tests/florida-order.spec.ts` | 56 | 1 | new medical only |

CA/CO/NJ 4-test blocks are **~90% identical** (~380 of ~420 lines).

### Parameterizable Differences

```typescript
// utils/e2e-state-configs.ts
export const e2eStateConfigs = [
  {
    state: 'CA', tag: 'CA',
    fulfillment: 'Delivery',
    cartMethod: 'addProductsToCart', cartCount: 4,
    checkoutMethod: 'confirmCheckout',
    existingUserZip: '94020',
    newUserAddress: '123 Rodeo Dr, Beverly Hills, CA 90210',
    addressHelper: 'addAddress',
    testMatrix: ['existingMed', 'existingRec', 'newMed', 'newRec'],
  },
  {
    state: 'CO', tag: 'CO',
    fulfillment: 'Pickup',
    cartMethod: 'addProductsToCartPickup', cartCount: 6,
    checkoutMethod: 'confirmCheckoutColorado',
    existingUserZip: '80304',
    newUserAddress: 'random from coloradoAddressess',
    addressHelper: 'addColoradoAddress',
    testMatrix: ['existingMed', 'existingRec', 'newMed', 'newRec'],
  },
  {
    state: 'MI', tag: 'MI',
    fulfillment: 'Pickup',
    cartMethod: 'addProductsToCart', cartCount: 6,
    checkoutMethod: 'manualMi',
    testMatrix: ['newRecInState', 'newRecOutOfState'], // no existing-user tests
    accountMethod: 'createMichiganCustomer',
  },
  {
    state: 'FL', tag: 'FL',
    fulfillment: 'Delivery',
    cartMethod: 'addProductsToCart', cartCount: 6,
    checkoutMethod: 'confirmCheckout',
    testMatrix: ['newMed'], // single scenario
  },
]
```

**Estimated savings:** ~380 lines from CA/CO/NJ merge; MI and FL remain as config overrides.

---

## 3. Gate Setup Boilerplate

### Current State

This sequence appears in **~20 spec files** with only whitespace differences:

```typescript
const ageGatePage = new AgeGatePage(page)
const listPassword = new ListPasswordPage(page)
// ... other page objects ...
var mobile = workerInfo.project.name === 'Mobile Chrome'

await test.step('Pass Age Gate', async () => {
  await ageGatePage.passAgeGate()
})
await test.step('Enter List Password', async () => {
  await listPassword.submitPassword(process.env.CHECKOUT_PASSWORD || '')
})
```

Additionally, `passStorefrontGates` is **copy-pasted identically** in 3 admin-drop specs:

- `tests/admin-drop-tests/order-split.spec.ts` L72
- `tests/admin-drop-tests/focused-rules-minimum-order.spec.ts` L85
- `tests/admin-drop-tests/focused-rules-max-quantity.spec.ts` L31

### Proposed After

Extend `options.ts` with fixtures:

```typescript
// options.ts
export const test = base.extend<{
  storefront: {
    passGates: () => Promise<void>
    pages: { shop: ShopPage; cart: CartPage; checkout: CheckoutPage; ... }
  }
}>({
  storefront: async ({ page, qaClient }, use, testInfo) => {
    const ageGate = new AgeGatePage(page)
    const listPassword = new ListPasswordPage(page)

    await use({
      async passGates() {
        await ageGate.passAgeGate()
        await listPassword.submitPassword(testEnv.checkoutPassword)
      },
      pages: {
        shop: new ShopPage(page, testInfo.project.name, testInfo),
        cart: new CartPage(page, qaClient, testInfo.project.name, testInfo, 'recreational'),
        // ...
      },
    })
  },
})
```

```typescript
// In any spec:
test('order flow', async ({ storefront }) => {
  await storefront.passGates()
  await storefront.pages.shop.addProductsToCart(4)
})
```

**Estimated savings:** ~15 lines × 20 specs = ~300 lines of boilerplate removed.

---

## 4. Always-On Checkout Flows

### Current State

`models/always-on/checkout-page.ts` (946 lines) contains three near-identical checkout edit flows:

| Method | Lines | Audience |
|--------|------:|----------|
| `recEnterInfoForCheckoutAndEdit` | L124–357 (~233) | New rec user |
| `newMedEnterInfoForCheckoutAndEdit` | L359–614 (~255) | New med user |
| `recExistingCheckoutAndEdit` | L616–850 (~234) | Existing rec user |

Each repeats: address edit, appointment selection, phone/DOB entry, photo ID upload, payment block — with minor deltas.

### Proposed After

```typescript
// models/always-on/checkout-sections.ts
export class CheckoutSections {
  async editAddress(page: Page, expectedAddress: string) { /* shared */ }
  async selectAppointment(page: Page) { /* shared */ }
  async enterPersonalInfo(page: Page, opts: PersonalInfoOpts) { /* shared */ }
  async uploadPhotoId(page: Page) { /* shared */ }
  async selectPayment(page: Page) { /* shared */ }
}

// models/always-on/checkout-page.ts
async enterInfoForCheckoutAndEdit(page: Page, profile: CheckoutProfile) {
  const sections = new CheckoutSections(page)
  if (profile.needsAddress) await sections.editAddress(page, profile.address)
  if (profile.needsAppointment) await sections.selectAppointment(page)
  await sections.enterPersonalInfo(page, profile.personalInfo)
  if (profile.needsPhotoId) await sections.uploadPhotoId(page)
  await sections.selectPayment(page)
}
```

Where `CheckoutProfile` is a discriminated union for rec/med/new/existing variants.

**Estimated savings:** ~600 lines.

---

## 5. Always-On Cart-Minimum Flows

### Current State

`models/always-on/homepage-actions.ts` (1,877 lines) has five near-identical cart-minimum loops:

| Method | Approx. lines | Variant |
|--------|-------------|---------|
| `conciergeRecAddProductsToCartUntilMinimumMet` | ~216 | Concierge rec |
| `conciergeMedAddProductsToCartUntilMinimumMet` | ~216 | Concierge med |
| `liveRecAddProductsToCartUntilMinimumMet` | ~185 | Live rec |
| `liveMedAddProductsToCartUntilMinimumMet` | ~230 | Live med |
| `medAddProductsToCartUntilMinimumMet` | ~180 | Generic med |

Plus 466 lines of **fully commented-out** old implementations (L876–1116).

### Proposed After

```typescript
async addProductsToCartUntilMinimumMet(
  page: Page,
  options: {
    channel: 'concierge' | 'live'
    usageType: 'recreational' | 'medical'
    minimumCents: number
  }
) {
  // Single loop with channel/usageType branching only where selectors differ
}
```

**Estimated savings:** ~800 lines (including commented block deletion).

---

## 6. Registration Flows

### Current State

`models/create-account-page.ts` (1,098 lines) has four registration entry points:

| Method | Used by | Overlap with `create()` |
|--------|---------|------------------------|
| `create()` | CA, CO, NJ, FL e2e/smoke | baseline |
| `createMichiganCustomer()` | MI e2e/smoke, generator | ~95% identical to `createCaliforniaCustomer` |
| `createCaliforniaCustomer()` | `pos-order-generator.spec.ts` only | ~95% identical to MI variant |
| `createColoradoCustomer()` | **commented out only** | duplicates `create()` with CO defaults |

Shared typo `"Enter Passowrd"` appears in all four flows.

### Proposed After

```typescript
async create(user: CreateUserOptions) {
  const profile = resolveStateProfile(user.state) // CA, CO, MI, NJ, FL defaults
  await this.fillRegistrationForm({ ...user, ...profile })
  if (profile.requiresDocumentUpload) await this.uploadDocuments(user)
  if (profile.requiresEligibilityStep) await this.completeEligibility(user)
}
```

Keep `createApi()` for API-based user creation. Deprecate state-specific methods.

**Estimated savings:** ~400 lines.

---

## 7. Playwright Config Sprawl

### Current State

12 configs in `configs/` with heavy duplication:

| Config group | Files | Duplication |
|--------------|-------|-------------|
| Prod state | `prod-ca`, `prod-co`, `prod-fl` | **Byte-identical** except `prod-ca` has extra `PlaywrightTestConfig` import (verified via `diff`) |
| Prod MI | `prod-mi` | Same shell, MI-specific `orders` fixture |
| Prod NJ | `prod-nj` | No orders fixture; Desktop Chrome only |
| Dev + staging | `dev.config.ts`, `staging.config.ts` | Same structure, different baseURL and timeouts |
| Special-purpose | automation, pos-sync, admin-drop, liveandconcierge | Different testDir — keep separate |

**Shared across most configs:** reporters (list, html, Slack webhook, S3, GitHub), `testIgnore: ['**/admin-drop-tests/**']`, Desktop + Mobile Chrome projects, `slowMo: 200`, `trace/video/screenshot: 'on'`.

### Proposed After

```typescript
// configs/base/list.config.ts
export function createListConfig(env: 'dev' | 'staging' | 'prod', overrides?: Partial<PlaywrightTestConfig>) {
  return defineConfig({
    ...sharedListDefaults,
    use: { baseURL: baseUrls[env], ...sharedUse },
    ...overrides,
  })
}

// configs/prod.config.ts
export default createListConfig('prod', {
  use: { baseURL: process.env.BASE_URL },
  orders: ordersProfiles[process.env.ORDERS_PROFILE ?? 'ca'],
})
```

**Reduction:** 12 configs → ~5–6 (list, prod, admin-drop, automation, pos-sync, liveandconcierge).

---

## 8. Age Gate / Password Gate Logic

### Current State

Age gate handling is implemented in four places:

| Location | Method |
|----------|--------|
| `models/age-gate-page.ts` | `passAgeGate()`, `findVisibleAgeGateButton()` |
| `models/admin-drop/focused-rules-storefront-page.ts` | `passAgeGateIfPresent()` |
| `models/admin-drop/ca-storefront-gate-page.ts` | Inline gate click |
| `tests/admin-drop-tests/*.spec.ts` | `passStorefrontGates()` × 3 copies |

MI uses button text `"I qualify"`; other states use `"I'm over 21 or a qualified patient"`.

### Proposed After

Single `GatePage` (or extend `AgeGatePage`) with:

```typescript
async passAgeGateIfPresent(options?: { stateHint?: 'mi' | 'default' }) {
  const button = await this.findVisibleAgeGateButton(options?.stateHint)
  if (button) {
    await button.click()
    await expect(this.page.locator('.age-gate-wrapper')).toBeHidden()
  }
}
```

Used by legacy tests, admin-drop tests, and load-test funnel processors.

**Estimated savings:** ~100 lines across 4 locations.

---

## 9. Artillery / Loadtest Funnel Overlap

### Current State

| File | Lines | Purpose |
|------|------:|---------|
| `artillery/artillery-scripts.js` | ~800 | CA browser funnel processor |
| `loadtest/flows/funnel.js` | ~1,044 | Browser funnel for drop simulation |

Both implement: QA bypass cookies → age gate → list password → registration → cart → checkout.

DL test images are triplicated in `artillery/`, `k6/`, and `loadtest/fixtures/`.

### Proposed After (Long-term)

```javascript
// shared/funnel-steps.js
module.exports = {
  passAgeGate,
  submitListPassword,
  createAccount,
  addToCart,
  completeCheckout,
}

// artillery/artillery-scripts.js
const { passAgeGate, ... } = require('../shared/funnel-steps')

// loadtest/flows/funnel.js
const { passAgeGate, ... } = require('../../shared/funnel-steps')
```

**Estimated savings:** ~500–700 lines of duplicated funnel logic (Phase 5+ effort).

---

## Duplication Summary

| Area | Current lines | Est. removable | Priority |
|------|-------------:|---------------:|----------|
| Smoke specs (5 → 1) | ~404 | ~280 | P0 |
| E2E specs (CA/CO/NJ → 1) | ~483 | ~380 | P0 |
| Gate boilerplate (20 specs) | ~300 | ~300 | P0 |
| Always-on checkout flows | ~722 | ~600 | P1 |
| Always-on cart-minimum flows | ~1,027 | ~800 | P1 |
| Registration flows | ~400 | ~400 | P1 |
| Playwright configs (12 → 6) | ~1,200 | ~400 | P2 |
| Age gate logic (4 places) | ~200 | ~100 | P2 |
| Artillery/loadtest funnel | ~1,800 | ~600 | P3 |
| **Total estimated** | | **~3,860 lines** | |
