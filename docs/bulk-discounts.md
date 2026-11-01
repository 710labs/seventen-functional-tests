# Bulk discounts in the existing E2E suite

Bulk tests live in `tests/cart-tests/bulk-discount-tests.spec.ts`. They import `test`
from `options.ts`, use the existing `qaClient`, and run with the existing dev
configuration, desktop/mobile projects, workflow, and Slack/health/HTML/video reporters.
Public hosted reports were explicitly approved for this suite on November 1, 2026,
superseding the handoff's private-evidence requirement. There is no separate live runner.

## Running

The normal CA command includes bulk tests alongside existing tests:

```bash
npm run ci:test:dev:ca
```

To focus on the new specs with the same runner/configuration:

```bash
node scripts/run-public-playwright.js tests/cart-tests/bulk-discount-tests.spec.ts --config=configs/dev.config.ts --workers=1
```

Use the existing `CHECKOUT_PASSWORD`, `API_KEY`, `QA_ENDPOINT`, `RECAPTCHA_BYPASS`,
`NEXT_VERSION`, and `ADD_ADDRESS_BEFORE_CHECKOUT` setup. Ordinary users are created
through `CreateAccountPage.createApi`, just like existing CA order tests. Fresh
registration uses `CreateAccountPage.create` and the existing test-email convention.
No separate plain-user credentials are required.

The dev config enables bulk tests through metadata. Other configs skip them before
login/account/cart actions. Enabled tests fail if their base URL is not the exact HTTPS
dev origin. Top-level browser navigation is restricted to that origin; catalogue API
requests refuse redirects. Tags `@CA` and `@bulk` keep these CA rules out of MI/CO/NJ runs.

## Shared code

| Work | Existing methods reused |
| --- | --- |
| Gates/login | AgeGatePage.passAgeGate, ListPasswordPage.submitPassword, LoginPage.login |
| Accounts | CreateAccountPage.createApi/create, MyAccountPage.addAddress/logout |
| Shopping | ShopPage.openStorefrontForFulfillment, getAddableStorefrontProducts, addStorefrontProduct, goToCart, clearStorefrontCart |
| Checkout/order | CartPage.goToCheckout, CheckoutPage.selectSlot/submitOrder, OrderReceivedPage.getOrderNumber |

New methods extend those same page objects. ShopPage matches paginated Store API category
metadata to addable menu products and delegates selected-product additions to its existing
add method. CartPage owns quantity edits, removal, product/quantity checks and cleanup
verification. Cart and checkout share `models/components/order-pricing.ts` for coupon
labels/amounts, absence of Remove links, subtotal, all three taxes and total.
OrderReceivedPage verifies the confirmed discounted total. The E2E specs have no UI selectors.

The supplied markup is used by the shared page objects: ShopPage checks
`.svntn-wdr-offers` / `.svntn-wdr-chip`, including whole-dollar `$5`/`$7` amounts;
CartPage checks the `.svntn-wdr-section` heading and `.svntn-wdr-row` grouping, plus each
product's `.svntn-wdr-tag` text and known `data-wdr-coupon` key. Checkout uses its ordinary
`tfoot .cart-discount` rows without requiring the cart-only heading/classes. Tier changes
must replace the old badge; below-threshold/non-eligible lines must have no badge.
Shop price discovery excludes offer-chip amounts so `$5 off each` cannot become a
product's apparent unit price in any existing shopping flow.

Existing behavior of `BYPASS_TAX_CALC` is unchanged. Explicit bulk pricing assertions
always verify taxes, even when that legacy switch is true. Each ordinary test uses
its own generated user. Cleanup uses the existing clear-cart method in afterEach.
Order tests add a `bulk-regression:` note and disable retries to avoid duplicate orders
after a confirmation failure. These cases do not modify stock, menus, or global rules.

## Implemented E2E scenarios

- All five categories: 2→3→4→5→6→4→5 units, exact labels/amounts/taxes/total.
- J1: 2+1 eighths plus below-threshold vapes/gummy; 3→5→3→2→3 via removal/re-addition;
  category isolation and checkout summary.
- J2: all five discounts, mixed eighth prices, checkout and order confirmation.
- J5: existing-user logout/login persistence and freshly registered user's first order,
  using the suite's existing desktop and mobile projects.

Implementation is not evidence of a successful live run. Missing inventory and pricing
mismatches fail normally. The complete handoff still needs PDP-specific rendering, pickup-store
switching, J2 refund/admin-edit checks, J3 account-discount browser flow, J4 stock interruption,
full J6 catalogue/variation sweep, J7 BOGO browser/order verification, Woo REST order checks,
confirmation emails, and per-POS read-back. No placeholder specs claim those checks pass.
Discovery currently covers addable products on the loaded menu, not every variation or
products with missing category assignments.

## Offline verification and fixture

```bash
npm run test:bulk:unit
node scripts/run-public-playwright.js tests/unit/bulk-discount-page-objects.spec.ts --config=configs/unit.config.ts
```

The existing dev CA workflow runs the oracle tests before E2E execution. Node unit tests
need no network, secrets, or browser. Synthetic Playwright tests use the existing unit
configuration and the real page-object methods, including rejection of stale tiers,
Remove links, and incorrect taxes.

`support/bulk-discounts/rules.json` is the single source of expected rules. It transcribes
the handoff's October 31 export description and TheList_BulkDiscount_QA_Tracker_v4.xlsx:
Expected Values C5:C7, A11:G15, A19:E39, C62, G59:L65, and Journey Steps. The original
Flycart JSON export was not supplied. Tax settings, labels, and BOGO category remain
unverified against dev.

The pure oracle accepts decimal-dollar prices and returns integer USD cents. It counts
paid units across SKUs within each category, excludes free BOGO units, applies account
percentage after bulk, and compounds/rounds each tax separately. It honors the 999-unit
cap and rejects overlapping categories or discounts exceeding the eligible subtotal.
It does not prescribe per-line coupon allocations.

The seeded generator prepares 200 plans, including golden J0/J1–J5/J7 carts; it is an
offline utility, not a separate running API suite. E2E carts use its resolver with actual
catalogue prices. J2 requires two price points. Fixed totals occur only in offline
reference assertions, independently evaluated from the workbook with decimal arithmetic.

To update rules:
1. Obtain a fresh dev export; update IDs/categories/tiers/amounts/account/BOGO and provenance.
2. Keep exported titles/cart labels separate from expected label templates. User-provided
   markup confirms `Live Rosin Badder {min}+` and `Live Rosin Vapes {min}+`, with coupon
   keys `live-rosin` and `live-rosin-vapes-bulk-discount`. Other templates still follow
   the workbook and await confirmation. Do not normalize away unexpected labels.
3. Confirm taxes and bases for the pickup store; model store-specific differences explicitly.
4. Run offline, synthetic page-object, and normal dev E2E tests. Update pinned offline
   reference values only for an approved rule change.

## Findings and remaining inputs

Journey Steps D20 lists $36.15 for J3 at four eighths. The calculator yields
`(4×$39 + 3×$25 − 4×$5 − 3×$3) × 15% = $30.30`; the regression follows the formula.
Expected Values L35 has an outdated logged-out-cart note; J5 follows registration-first
steps. The workbook was not modified.

The public dev Store API probe returned HTTP 200 with coupon/tax/total fields on
November 1, 2026. Empty unauthenticated arrays do not establish Flycart coupon behavior.
The new integrated tests validate the rendered cart.

The supplied cart and checkout markup still contains `[Remove]` controls. Their absence
remains an assertion from the handoff, so this markup fails that specific UI check.
Monetary assertions run first so this known issue cannot hide an incorrect discount or
tax total. Synthetic tests cover both the supplied markup's expected failure and the
same structure with only the Remove links omitted; no live application markup is changed.

Advanced coverage still needs a user assigned to the percentage rule, Woo REST read
credentials, email test access, and POS sandbox/store details. The existing Persy health
check verifies transmission identifiers, not POS monetary data. These are additional
checks, not replacements for the existing login, account creation, or reporting setup.

## Validation on November 1, 2026

- 74 offline oracle/generator/guard tests passed.
- All 12 synthetic browser cases passed using the existing unit config and shared page
  objects, including the user-provided shop/cart/checkout markup (11 in the full run;
  the remaining badge case passed after correcting its error-message matcher).
- Dev discovery increased from 152 to 194: nine bulk E2E cases and twelve synthetic
  cases run across the existing two projects, alongside the original tests.
- Public-reporting policy validation and whitespace checks passed.
- One dev Eighths cart smoke test was attempted through the normal safe runner. It
  timed out in the existing LoginPage.login method before cart assertions; no order
  was submitted. Live pricing and order behavior remain unverified.
