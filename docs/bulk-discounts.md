# Bulk discounts in the existing E2E suite

Stage now includes the same nine scenarios for CA, FL, MI, CO, and NJ: 18 browser
cases per state (desktop + mobile), 90 across all five state runs. This expansion
passed 112 Node unit checks and 31 headless browser regression cases. State-filter
discovery selects exactly 18 cases per state, and public-reporting validation passes.
Full live orders in the four newly enabled states still need verification through
the Stage state jobs. Repository-wide TypeScript checking remains blocked by
existing errors outside the new state implementation, including loadtest Playwright
type conflicts and fixture scope declarations.

Bulk tests live in `tests/cart-tests/bulk-discount-tests.spec.ts`. They import `test`
from `options.ts`, use the existing `qaClient`, and run with the existing dev and staging
configuration, desktop/mobile projects, workflow, and Slack/health/HTML/video reporters.
Public hosted reports were explicitly approved for this suite on November 1, 2026,
superseding the handoff's private-evidence requirement. There is no separate live runner.

## Running

The normal state commands include bulk tests alongside existing E2E tests:

```bash
npm run ci:test:dev:ca
npm run ci:test:staging:ca
npm run ci:test:staging:fl
npm run ci:test:staging:mi
npm run ci:test:staging:co
npm run ci:test:staging:nj
```

To focus on the new specs with the same runner/configuration:

```bash
node scripts/run-public-playwright.js tests/cart-tests/bulk-discount-tests.spec.ts --config=configs/staging.config.ts --grep @CA --workers=1
```

Use the existing `CHECKOUT_PASSWORD`, `API_KEY`, `QA_ENDPOINT`, `RECAPTCHA_BYPASS`,
`NEXT_VERSION`, and `ADD_ADDRESS_BEFORE_CHECKOUT` setup. Every bulk test registers a new account in `beforeEach` through the shared
`CreateAccountPage.create` UI flow (or `createMichiganCustomer` for MI), with a unique test email. Registration leaves the
account signed in, and the setup verifies that its cart is empty. Account names identify
the state, case and project (for example, `Bulk FL Doinks Tiers / Desktop Chrome`).
Email addresses include the state, case, project, and
a unique run identifier. Reports retain the full case/run reference; it is also
filled into order notes when the checkout offers that field.
No separate plain-user credentials are required.

The dev and staging configs enable bulk tests through metadata. Other configs skip them before
login/account/cart actions. Enabled tests require the exact HTTPS dev or Stage origin.
Top-level browser navigation is restricted to the configured origin (including blocking
redirects between dev and Stage); catalogue API
requests refuse redirects. Each generated state group has its own `@CA`, `@FL`,
`@MI`, `@CO`, or `@NJ` tag plus `@bulk`, so existing state filters select exactly
18 bulk cases. Dev keeps its existing CA-only bulk coverage; production remains excluded.

The existing “List - Stage - All States” workflow runs CA, MI, CO, and NJ in sequence.
FL runs through the existing “List - FL - Stage - Functional Tests” workflow. Both
workflows share the Stage domain concurrency lock and select the backend state first.
For local runs, configure the domain for the requested state first, use the matching
`--grep @STATE`, and avoid concurrent runs that change Stage's domain state. Do not
run all 90 cases together against a domain configured for just one state.

| State | New account | Fulfillment |
| --- | --- | --- |
| CA | Recreational, California address | Pickup |
| FL | Medical, Florida address | Delivery |
| MI | Michigan registration, recreational, Michigan address | Pickup |
| CO | Recreational, Colorado address | Pickup |
| NJ | Recreational, New Jersey address | Pickup |

All states currently expect the same four Stage discounts: Eighths, Gummis, Vapes,
and Badder. Doinks remain full price on Stage and discounted on Dev. Missing bulk
discounts or required inventory produce ordinary failures, not skips. Stage
smoke-only workflows do not run this full suite.

## Shared code

| Work | Existing methods reused |
| --- | --- |
| Gates/login | AgeGatePage.passAgeGate, ListPasswordPage.submitPassword, LoginPage.login |
| Accounts | CreateAccountPage.create, MyAccountPage.addAddress/logout |
| Shopping | ShopPage.openStorefrontForFulfillment, getAddableStorefrontProducts, addStorefrontProduct, goToCart, clearStorefrontCart |
| Checkout/order | CartPage.goToCheckout, CheckoutPage.selectSlot/submitOrder, OrderReceivedPage.getOrderNumber |

New methods extend those same page objects. ShopPage matches paginated Store API category
metadata to addable menu products and delegates selected-product additions to its existing
add method. `getCategoryIdsBySlug` resolves the current environment's category IDs by
exact slug, with pagination and explicit failures for missing/ambiguous categories.
The suite remaps both pricing rules and journey plans before selecting products;
neither shop section order nor Dev's numeric category IDs determine Stage selection.
Reports record the resolved mapping in a `category-map` annotation.

Bulk cart setup checks catalogue stock/maximum quantities and then the actual cart's
quantity control before selecting a SKU. Hidden, read-only, missing or capped controls
reject that candidate; any added unit is removed and the next SKU in the same bulk
category is tried. Tier cases require capacity for six units; J1 reserves capacity for
its later three-unit mutation. Replacements remain distinct across cart lines and their
actual prices feed the oracle. Rejections appear as `inventory-candidate-rejected`
annotations. Exhausted inventory remains an explicit coverage failure; an unexplained
wrong product ID or server error is not converted into a pass.

Bulk storefront visits use the existing state fulfillment flow and accept whichever store the
site selects. `ShopPage.getFulfillmentLabel` records the actual store in a `fulfillment-store`
annotation. There is no required store name and no attempt to force a different partner.
After the cart contains the scenario products, `CartPage.getTaxRateMetadata` reads
`totals.tax_lines` from the authenticated Store API. Only tax names and percentage
rates are used; reported tax amounts and totals are discarded. Missing or malformed
rates fail explicitly rather than falling back to Dev or a different Stage store.

`rulesWithCartTaxRates` captures those rates once per test. CA retains its verified
compound tax structure. Other states read WooCommerce's tax settings once per worker
through the shared admin login page object, using an isolated context without video or
trace recording. This uses the existing `ADMIN_USER` and `ADMIN_PW` credentials and
only reads settings. The QA `/rates` endpoint is not used here because it currently
hardcodes California, even for MI and CO postal codes.

Cart tax row codes identify the actual fulfillment jurisdiction and priority. The cart's
"estimated for" suffix is presentation text and is excluded when matching API tax names.
When no tax rows are returned, the selected pickup/delivery address must independently
identify a jurisdiction with no applicable nonzero configured rates (including wildcard
rates). Otherwise missing taxes still fail. This supports Stage NJ's current tax-free
configuration without making every empty tax response pass. Each row
must match its configured jurisdiction, priority, label and percentage in the account's
`standard` or `medical-rate` tax class. This supports a store in a different jurisdiction
from the test address. Missing tax priorities and ambiguous compounding fail explicitly;
reported tax amounts never become expectations. Rates support four decimal places. The oracle
calculates regular taxes before compound taxes in configuration order, following
[WooCommerce's calculation](https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/includes/class-wc-tax.php). The existing oracle independently
computes discounts, taxable bases, compound taxes, per-line rounding, and totals. Those
expectations remain fixed through quantity changes, logout/login, checkout, and order
confirmation. Reports record the captured rates in `tax-profile`. This validates tax
calculation after bulk discounts; verifying each store's configured tax percentages is
outside this suite's scope.

| Category | Slug | Dev ID | Stage ID (November 2, 2026) |
| --- | --- | ---: | ---: |
| Vapes | live-rosin-vapes | 323 | 319 |
| Badder | live-rosin-badder | 327 | 312 |
| Gummis | gummis-2 | 324 | 323 |
| Eighths | eighths | 331 | 325 |
| Doinks | doinks | 326 | 320 |

These IDs document the observed catalogue; browser tests resolve them at runtime.
Stage also uses different coupon identifiers: `live-rosin-vapes` and
`live-rosin-badder`, versus Dev's `live-rosin-vapes-bulk-discount` and `live-rosin`.
`stage-rule-metadata.json` records these observed differences. The selected environment
profile supplies the coupon identifiers while retaining the shared business labels and tiers.
The user confirmed Stage enables only Eighths, Gummis, Vapes, and Badder: its Doinks
rule is explicitly disabled. All 18 tests per state remain present. Stage's Doinks quantity
scenario verifies full-price lines with no discount badge or coupon; J2 and J5 keep
Doinks in their carts and verify that only enabled categories receive discounts.
Dev retains both Doinks tiers. Reports record this distinction in `bulk-rules` annotations.
Selected-product additions identify the Add button by product ID, use
a normal actionable click, and visit the cart after every addition. The cart POM
checks that exact product ID and an increment from its pre-add quantity. Header
counts and drawer text are readiness hints, not proof of a selected product being
added. A stale hint never triggers a duplicate click. CartPage owns quantity edits,
removal, product/quantity checks and cleanup
verification. Cleanup waits for each product row to disappear and the cart loading
overlay to clear before selecting the next Remove link. Cart and checkout share `models/components/order-pricing.ts` for coupon
labels/amounts, subtotal, all configured tax rows and total. Coupon Remove controls are
ignored: neither their presence nor their behavior is tested.
OrderReceivedPage verifies the confirmed discounted total. The E2E specs have no UI selectors.

Shop offers are informational badges. Bulk E2E tests add eligible products normally
through `ShopPage.addSelectedProducts` and the existing add-to-cart methods, then
check the resulting discounts in the cart and checkout. They neither interact with
nor wait for shop offer badges. The standalone visual-check helper is covered only
by synthetic fixtures and is not part of the bulk purchase flow.
CartPage checks the `.svntn-wdr-section` heading and `.svntn-wdr-row` grouping, plus each
product's `.svntn-wdr-tag` text and known `data-wdr-coupon` key. Checkout uses its ordinary
`tfoot .cart-discount` rows without requiring the cart-only heading/classes. Tier changes
must replace the old badge; below-threshold/non-eligible lines must have no badge.
Shop price discovery excludes offer-chip amounts so `$5 off each` cannot become a
product's apparent unit price in any existing shopping flow.

Existing behavior of `BYPASS_TAX_CALC` is unchanged. Explicit bulk pricing assertions
always verify taxes, even when that legacy switch is true. Each test uses
its own freshly registered user; only the logout/login scenario signs in again, using
that same test account. Cleanup uses the existing clear-cart method in afterEach.
Order tests retain a `bulk-regression:` report reference, fill optional checkout
notes when available, and disable retries to avoid duplicate orders
after a confirmation failure. These cases do not modify stock, menus, or global rules.

## Implemented E2E scenarios

- All five categories: 2→3→4→5→6→4→5 units, exact labels/amounts/taxes/total, then
  order submission and confirmation total.
- J1: 2+1 eighths plus below-threshold vapes/gummy; 3→5→3→2→3 via removal/re-addition;
  category isolation, checkout summary, order submission and confirmation total.
- J2: all configured discounts (five on Dev, four on Stage), two distinct eighth SKUs
  (currently both $39), checkout and order confirmation; Stage Doinks stay full price.
- J5: newly registered user logout/login persistence and freshly registered user's first order,
  using the suite's existing desktop and mobile projects.

Every one of the nine scenarios submits one order after its checks pass (18 orders per state
across the two projects on a fully passing run). For under-minimum carts, the shared
order helper uses the existing POM minimum banner and add/quantity methods to add a
companion product outside the scenario categories, preserving the tested quantities.
It verifies the complete expanded cart before checkout and annotates the report with
the confirmed order number. Earlier failures still stop submission.

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
configuration and the real page-object methods, including rejection of stale tiers
and incorrect taxes, and acceptance of pricing markup with or without Remove links.

`support/bulk-discounts/rules.json` contains the bulk rules and workbook reference taxes. It transcribes
the handoff's October 31 export description and TheList_BulkDiscount_QA_Tracker_v4.xlsx:
Expected Values C5:C7, A11:G15, A19:E39, C62, G59:L65, and Journey Steps. The original
Flycart JSON export was not supplied. Workbook taxes remain as reference values;
labels and BOGO category still need full dev verification.

Live bulk tests use `support/bulk-discounts/tax-profiles.cjs` to select expectations
by the exact configured environment URL. Each test records its selected rates in a
`tax-profile` report annotation. Unknown environments fail instead of falling back
to dev. Both environments share tier definitions; Stage's enabled categories and
coupon identifiers come from its explicit rule metadata.

The reference fixture `support/bulk-discounts/dev-pickup-taxes.json` describes the observed Dev
pickup store, Spaceflyt Sandbox: 11% gross, 15% excise on subtotal plus gross,
and 9.5% sales on subtotal plus gross plus excise. Taxes use each product line after
its bulk discount, keep unrounded compound bases, round each line tax, then sum the
tax rows. These rates were confirmed from a fresh-account dev cart on November 1, 2026:
$120.00 subtotal, $13.20 gross, $19.98 excise, $14.55 sales, $167.73 total. The user
approved matching current dev rates. The authenticated Store API also reports
11% / 15% / 9.5%. Its discounted J5 lines ($102 and $33) yield $14.85 gross,
$22.47 excise, $16.37 sales, and $188.69 total; rounding excise on the combined
subtotal instead would incorrectly expect $22.48. A second observed cart ($136
and $33 after discounts) yields $236.21. The line calculation follows
[WooCommerce tax compounding](https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/includes/class-wc-tax.php)
and [line-tax rounding](https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/includes/traits/trait-wc-item-totals.php).
These pinned fixtures remain offline regression examples. Live browser tests replace
their rates with the selected store's metadata before making any pricing assertions.
Offline workbook assertions retain their original 8% / 15% / 7.75% rates.

`support/bulk-discounts/stage-pickup-taxes.json` preserves the observed Stage
cart on November 2, 2026 contained three $39 Rainbow Belts eighths: $117 subtotal,
$15 bulk discount, $102 discounted subtotal, $8.16 County Gross Tax,
$16.52 California Excise Tax, $12.03 Sales, and $138.71 total. These amounts are
consistent with 8% gross, 15% compounded excise, and 9.5% compounded sales. A fresh-account
browser diagnostic confirmed those exact rates through the authenticated Store API.
The selected pickup store was March and Ash Mill Valley. Two distinct $39 eighth SKUs
at quantities 3+1 produced $10.88 gross, $22.03 excise, $16.04 sales and $184.95 total;
at 3+2 they produced $12.80 gross, $25.92 excise, $18.88 sales and $217.60 total.
Both carts passed the shared cart assertions, confirming per-line rounding. These are
reference examples, not required rates for every Stage store.

The initial November 2 full Eighths scenario attempt stopped before tax assertions because
its catalogue lookup used dev category 331, while Stage's Eighths category is 325.
The separate tax diagnostic used the confirmed Stage category and did not submit an order.
Its tax assertions passed, but final cart cleanup timed out when a loading overlay
intercepted a product Remove click. The subsequent slug-resolution and cleanup changes
address these two automation issues separately from tax expectations.

The pure oracle accepts decimal-dollar prices and returns integer USD cents. It counts
paid units across SKUs within each category, excludes free BOGO units, applies account
percentage after bulk, and compounds/rounds each tax separately. It honors the 999-unit
cap and rejects overlapping categories or discounts exceeding the eligible subtotal.
The live profile allocates the configured flat per-unit bulk discount to each paid
product line for tax calculation. Its browser cases use plain accounts; percentage
coupon allocations must be verified before using the line profile with VIP users.
The workbook mode continues to support the existing offline VIP calculations.

The seeded generator prepares 200 plans, including golden J0/J1–J5/J7 carts; it is an
offline utility, not a separate running API suite. E2E carts use its resolver with actual
catalogue prices. J2 requires two distinct eighth products, not two price points;
the user confirmed that all current eighths intentionally cost $39. Its 3+2 split
must earn the five-unit discount ($35). A regression verifies equal-price selection
and rejects insufficient distinct inventory. Original workbook totals remain in
offline reference assertions, independently evaluated with decimal arithmetic.

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

The user clarified that `[Remove]` controls are expected to be present but nonfunctional,
and explicitly excluded them from testing for now. This overrides the earlier handoff's
absence requirement. The shared cart/checkout assertion does not inspect or click these
controls. Synthetic fixtures verify pricing with or without them; stale discounts and
incorrect monetary values still fail. Earlier run results below describe the old assertion.

Advanced coverage still needs a user assigned to the percentage rule, Woo REST read
credentials, email test access, and POS sandbox/store details. The existing Persy health
check verifies transmission identifiers, not POS monetary data. These are additional
checks, not replacements for the existing login, account creation, or reporting setup.

## Dev run 41356697095: storefront failures

The [dev run](https://github.com/710labs/seventen-functional-tests/actions/runs/41356697095)
on commit `bffe32c` had 18 bulk failures across desktop/mobile. The detailed HTML report
shows that fresh UI registration completed in every bulk case:

- 13 failed before adding products because the pricing-offer selector looked beside
  `ul.products`. Live DOM inspection confirmed that JavaScript wraps that list in
  `div.products-container.standard-list`; the offers are beside the wrapper. The
  shared ShopPage lookup now handles that wrapper and the unwrapped/card variants,
  without borrowing another category's offers. On all five live categories the old
  XPath matched zero elements and the corrected wrapper lookup matched one.
  Following the user's clarification, this visual check was removed from the bulk
  purchase flow entirely: informational badges must not block adding products.
- 3 waited over 14 minutes for `networkidle` in `openStorefrontForFulfillment`.
  That method now uses `domcontentloaded`, existing fulfillment readiness checks,
  and a visible product assertion. A synthetic browser test keeps a background
  request pending and verifies that storefront readiness still succeeds.
- 2 failed J2's mixed-price inventory prerequisite. The dev Store API returned six
  in-stock eighths, all $39.00. The user subsequently confirmed this is intentional;
  J2 now accepts distinct SKUs at the same price and retains cross-SKU tier coverage.

The safe CI summary incorrectly reported registration for these failures because
`expect.poll` left failed intermediate steps inside successful setup. Failure
classification now matches the actual test errors before falling back to step errors.
Bulk cleanup starts only after a cart mutation is attempted, preserving the original
page when setup fails before anything is added.

Validation for these fixes: 74 oracle/scenario/guard tests and six diagnostic tests
passed. All 15 synthetic bulk browser cases passed. Live selector counts were checked
read-only in the existing authenticated browser. Local diagnostic sign-in remained on
`/my-account/`, so this is not a claim that the full live bulk suite passes. No orders
were placed by these diagnostics, and the GitHub workflow has not been rerun with the
uncommitted fixes.

## Validation on November 1, 2026

After the user-approved dev tax profile and equal-price J2 adjustment:

- 78 oracle/scenario/guard tests passed, including current pickup tax calculations
  before and after discounts, and J2's distinct $39 SKU regression.
- All 16 synthetic browser checks passed through the existing cart/checkout POMs.
- A separate fresh-account headless dev cart confirmed the pickup tax profile.
- Public-reporting policy validation and whitespace checks passed.
- The full 18-case headless run initially failed: ten category cases reached the
  no-Remove-controls assertion after passing two- and three-unit monetary checks;
  J1/J2 failed four times when the second eighth addition was not confirmed; four
  J5 cases exposed per-line excise rounding.
- After fixing rounding, all four J5 cases were rerun: all monetary checks passed,
  then each failed the no-Remove-controls assertion. Their remaining Doink cleanup
  also timed out. No orders were submitted; later tiers and checkout were not reached.
  The full 18-case suite was not repeated after this targeted correction.

Earlier full local headless rerun after configuring `RECAPTCHA_BYPASS`, before the
user-approved tax and J2 changes:

- All 18 cases ran on the existing desktop/mobile projects: zero passed, 18 failed,
  zero skipped. Fresh registration succeeded throughout; no orders were submitted.
- 14 cases failed gross tax: the workbook oracle assumes 8%, while the rendered
  carts show 11%. The later store-specific profile corrects this mismatch.
- J1 failed twice: the shared add-to-cart helper did not confirm adding the second
  eighth, with the cart count remaining one. Diagnostics identify the selected
  pickup as Spaceflyt Sandbox.
- J2 failed twice because all six eligible eighths cost $39; the later user-approved
  scenario removes that mixed-price prerequisite.
- All four J5 cases passed the initial cart's three-eighth ($15) and three-Doink
  ($9) discount checks, then failed gross tax ($14.85 versus $10.80 expected).
  Logout/login, checkout and order placement were not reached. Category boundary
  cases stopped at two units, before their 3+/5+ transitions.

Earlier local headless attempt, before configuring the bypass:

- Aligned the local install with the lockfile: Playwright 1.59.1 and Chromium 147,
  running under Node 22.19.0, with the existing dev config and fresh UI accounts.
- Desktop Vapes and Badder were rejected by the site as spam during registration.
  The local `RECAPTCHA_BYPASS` is unset.
- Mobile Vapes reached cart assertions and failed gross tax: expected $9.60,
  actual $13.20. This requires checking the selected store's tax configuration;
  the expected rates were not changed to match the observed output.
- Stopped the run after the registration blocks: zero passed, three failed,
  one interrupted, fourteen not started. No order scenario ran.
- Local S3 report preflight failed; results were saved locally instead.

After switching every bulk test to UI registration:

- All 13 synthetic browser cases passed, including category-level offer isolation.
- Discovery found all nine bulk cases on both existing projects (18 runs), with no errors.
- Public-reporting policy validation and whitespace checks passed. TypeScript still
  reports 15 existing diagnostics, with none in the files changed for this update.
- A live dev Eighths cart test was run with the shared registration page object. It
  failed waiting for the eligibility/license step after submitting the new-customer
  form (`models/create-account-page.ts:478`). No discount assertions or order placement
  were reached. The local environment has no `RECAPTCHA_BYPASS` configured; this is a
  setup difference to check, not a confirmed cause of the missing eligibility step.

Earlier validation, before the registration change:

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

## All scenarios submit orders and identify their accounts

Each category case and J1 now submits an order after its cart/checkout assertions,
joining J2 and both J5 cases. All nine scenarios use one shared order helper and
the existing cart, checkout, and order-received page objects. All 18 desktop/mobile
cases therefore attempt one order each, with retries disabled.

Case/project account names, short case/project email identifiers, and report references
identify the run. Email-based usernames stay within WordPress's 60-character limit.
The dev checkout has no notes field; notes are optional, while case/run references
and confirmed order numbers are retained as report annotations.

Validation: 78 oracle/scenario/guard tests and 18 synthetic browser checks passed.
The headed Desktop Doinks case passed all tier changes, added a companion product
to satisfy the pickup minimum, submitted order **182318** under
**Bulk Doinks Tiers / Desktop Chrome**, and verified its confirmation total.
The full 18-case headed run was restarted with failed-test videos and a local HTML
report; that run's result is pending.

## Local replay videos for passed and failed tests

The user requested videos for successful runs as well. The ignored local config
`output/playwright/local-video.config.ts` inherits the dev config and uses
`video: 'on'`, retaining recordings for every result in the local HTML report.
Earlier local runs used `retain-on-failure`, which deleted passed-test videos.
Those deleted recordings cannot be added retroactively; a new run is needed.

The J1/J2 rerun after exact cart ID/quantity verification passed all four
desktop/mobile cases. A full 18-case headed run was then started with all videos
retained. Its report opens automatically when the run completes.
