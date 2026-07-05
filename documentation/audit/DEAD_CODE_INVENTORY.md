# Dead Code Inventory

**Status:** All items flagged for team review. Check the box when approved for deletion.

Evidence was verified via repo-wide grep, import analysis, and CI/npm script cross-reference (July 2026).

---

## Tier 1 — Zero References (High Confidence)

These files or packages have **no imports, no npm script, and no CI workflow** referencing them.

### Orphaned Page Object Models

| Review | File | Lines | Evidence |
|--------|------|------:|----------|
| [ ] | `models/scheduling-page.ts` | 34 | `SchedulingPage` class defined only in this file. Zero imports across all `.ts`/`.js` files. |
| [ ] | `models/admin/edit-profile-page.ts` | 45 | `EditProfilePage` class defined only in this file. Zero imports. Superseded by admin-drop order-split flow. |

### Orphaned Playwright Configs (Root Level)

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `playwright.config.ts` | Not referenced by any `package.json` script or `.github/workflows/*.yml`. Uses legacy `playwright-slack-report` reporter. **Bug:** `testDir: './../tests'` resolves outside repo when run from root. |
| [ ] | `local.config.ts` | Superseded by `configs/local.config.ts`. Not in any npm script or workflow. Same `testDir` path bug. |
| [ ] | `utils_playwright.config.ts` | Only serves `utils/treez_inventory_test.spec.ts`. No npm script references this config. |

### Orphaned Reporters

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `reporters/slack/slack-alert-layout.ts` | Only imported by orphaned `playwright.config.ts`. Active configs use `pw-slack-webhook-reporter.ts` instead. |
| [ ] | `reporters/s3/pw-report-s3-upload-generators.ts` | Never imported anywhere in repo. |

### Stale Delivery-Slot CSVs

All month/location variants are git-tracked but have **zero grep hits** anywhere in the repo. `ACUITY_SLOT_FILE` env defaults to `delivery-slots.csv`.

| Review | File | Size | Evidence |
|--------|------|-----:|----------|
| [ ] | `utils/delivery-slots-ca-old.csv` | 34.7 KB | Zero references |
| [ ] | `utils/delivery-slots2.csv` | 7.8 KB | Zero references |
| [ ] | `utils/delivery-slots4.csv` | 29.4 KB | Zero references |
| [ ] | `utils/delivery-slots-co-june29.csv` | 7.7 KB | Zero references (June 2025 snapshot) |
| [ ] | `utils/delivery-slots-mi-july.csv` | 9.4 KB | Zero references (July snapshot) |
| [ ] | `utils/delivery-slots-culver-july.csv` | 13.4 KB | Zero references |
| [ ] | `utils/delivery-slots-sticky-grove-july.csv` | 17.1 KB | Zero references |

**Keep:** `utils/delivery-slots.csv` — canonical file used by `acuity-slot-generator.spec.ts`, `acuity-dev-data.spec.ts`, `scripts/validate-acuity-slots.js`, and CI workflow.

### Unused Zipcode JSON

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `utils/zipcodes-mi.json` | Zero imports. `models/checkout-page.ts` only imports `zipcodes-ca.json` and `zipcodes-co.json`. |
| [ ] | `utils/zipcodes-fl.json` | Zero imports. |

### Abandoned Load Test Stack

| Review | File/Dir | Evidence |
|--------|----------|----------|
| [ ] | `k6/script.js` | Zero npm scripts, zero CI workflows. Marked `AI-GENERATED SCRIPT` at line 1. |
| [ ] | `k6/CA-DL.jpg` | Only referenced by `k6/script.js`. |
| [ ] | `k6/Medical-Card.png` | Only referenced by `k6/script.js`. |

### Orphaned Utility Module

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `utils/admin-drop/minimum-order-storefront.ts` | Exports `satisfyMinimumOrderFromStorefront`. Zero imports. `focused-rules-minimum-order.spec.ts` uses `ShopPage` methods directly. |

### Orphaned Spec

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `utils/treez_inventory_test.spec.ts` | Tests external `login.dev.treez.io`. Only config is orphaned `utils_playwright.config.ts`. No npm script, no CI. |

### Unused npm Dependencies

Grep covered all `.ts`, `.js`, `.yml`, `.json` excluding `node_modules`.

| Review | Package | Evidence |
|--------|---------|----------|
| [ ] | `fs-extra` | Zero require/import in repo source |
| [ ] | `pixelmatch` | Zero references anywhere |
| [ ] | `artillery-plugin-fake-data` | Zero imports; Artillery 2 bundles its own plugins |
| [ ] | `artillery-plugin-faker` | Zero imports |
| [ ] | `@slack/web-api` | Only in `package.json`; transitive dep of `playwright-slack-report` |
| [ ] | `playwright-slack-report` | Only used by orphaned `playwright.config.ts` chain |
| [ ] | `@slack/types` | Only used by orphaned `slack-alert-layout.ts` |
| [ ] | `pngjs` | Imported in `models/always-on/account-page.ts` but never used in file body |

**Remove as a bundle:** `playwright-slack-report`, `@slack/types`, `@slack/web-api`, `reporters/slack/slack-alert-layout.ts`, `playwright.config.ts`.

### Committed Artifacts (Should Be Gitignored / Removed)

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `order_id.txt` | Listed in `.gitignore` but **committed** (contains order ID `171163`). Written by smoke tests at runtime. |
| [ ] | `.DS_Store` (root, `tests/`, `utils/`, admin-drop fixtures) | Not in `.gitignore`; committed |
| [ ] | `artillery-reports/test.json` | Not gitignored; committed CI artifact |
| [ ] | `CA-DL.jpg`, `Medical-Card.png` (repo root) | Duplicates of `artillery/` and `loadtest/fixtures/` assets |

**Tier 1 total:** ~16 files + `k6/` directory (~195 KB tracked)

---

## Tier 2 — Referenced but Likely Abandoned

These have code references but appear superseded, fully skipped, or not wired into CI.

### Legacy Test Folder

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `legacy-tests/admin-tests/split-orders-tests.spec.ts` | Not in any config `testDir`. Superseded by `tests/admin-drop-tests/order-split.spec.ts`. Contains 1 active test + 1 `test.skip` duplicate + 3 empty `test.skip` stubs. |

### Fully Skipped Specs

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `tests/cart-tests/auto-discount-tests.spec.ts` | Both tests use `test.skip`. Documented in `TEST_CASES.MD` but never runs in CI. References stale disposable email `account-credit-300@mail7.io`. |

### Superseded Generator Specs

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `utils/generators/acuity-dev-data.spec.ts` | Superseded by `acuity-slot-generator.spec.ts` (801 vs 277 lines). Still has npm script `helper:acuityslots:dev` but uses legacy Squarespace Acuity URLs and `waitForTimeout(12000)`. |
| [ ] | `utils/generators/house-of-dank-order-generator.spec.ts` | In `automation.config.ts` testDir but no npm script or CI workflow. ~149 CSV-driven tests for MI House of Dank orders. |
| [ ] | `utils/hod-orders.csv` | Only referenced by house-of-dank generator above. |

### Commented-Out Tests in Active Files

| Review | Location | Evidence |
|--------|----------|----------|
| [ ] | `tests/always-on-tests/prod-live.spec.ts` | Medical test ~55 lines commented out |
| [ ] | `tests/always-on-tests/prod-concierge.spec.ts` | Medical test ~43 lines commented out |
| [ ] | `tests/e2e-tests/colorado-order.spec.ts` L63 | `createColoradoCustomer` call commented out |
| [ ] | `tests/e2e-tests/*.spec.ts` (CA, CO, NJ, FL) | Commented `createAccountPage.create(...)` blocks in several files |

### Large Commented Blocks in Page Objects

| Review | Location | Lines | Evidence |
|--------|----------|------:|----------|
| [ ] | `models/always-on/homepage-actions.ts` | L876–1116 (~240 lines) | Old concierge cart-minimum implementations, fully commented |
| [ ] | `models/always-on/login-homepage.ts` | ~54 comment lines | Dead sign-in modal variants |
| [ ] | `models/always-on/checkout-page.ts` | Multiple blocks | Commented retry loops in checkout edit flows |

### npm Scripts with No CI Usage

| Review | Script | Evidence |
|--------|--------|----------|
| [ ] | `ci:test:prod:ca`, `ci:test:prod:fl` | Full prod e2e grep runs — no workflow uses them |
| [ ] | `live:smoke:always-on` | CI uses `live:ci:always-on` instead |
| [ ] | `helper:acuityslots` | CI acuity automation calls `npx playwright` directly |
| [ ] | `load:ca:dev`, `load:ca:stage:debug`, `load:thelist:*` | CI uses `artilleryio/action-cli` in workflows, not these npm scripts |
| [ ] | `admin:smoke:all` | Local convenience only; CI duplicates logic inline |

### Stale IDE Config

| Review | File | Evidence |
|--------|------|----------|
| [ ] | `.vscode/settings.json` | Pins `.github/workflows/playwright.yml` — **file does not exist** |

**Tier 2 total:** ~5 files + `legacy-tests/` folder + commented blocks

---

## Tier 3 — Dead Methods Inside Live Files

These files are actively imported but contain methods with zero callers.

### `models/checkout-page.ts`

| Review | Method | Line | Evidence |
|--------|--------|-----:|----------|
| [ ] | `confirmCheckoutDeprecated` | ~493 | Defined only; zero spec callers |

### `models/create-account-page.ts`

| Review | Method | Line | Evidence |
|--------|--------|-----:|----------|
| [ ] | `createColoradoCustomer` | ~1002 | Only reference is commented out in `colorado-order.spec.ts` L63 |
| [ ] | `createAccountLink` locator | ~55 | Declared, never used in class body |

### `models/shop-page.ts`

| Review | Method | Line | Evidence |
|--------|--------|-----:|----------|
| [ ] | `addSameProductToCart` | ~1285 | Zero spec callers. Contains **empty locator bug** at L1299: `page.locator(``).first().click()` |
| [ ] | `createAccountLink` locator | ~103 | Declared, never used |

### `models/always-on/checkout-page.ts`

| Review | Method | Line | Evidence |
|--------|--------|-----:|----------|
| [ ] | `enterPhoneNumber` | ~859 | Defined; zero spec callers |

### `models/always-on/homepage-actions.ts`

| Review | Method | Line | Evidence |
|--------|--------|-----:|----------|
| [ ] | `goToCheckout` | ~368 | Zero external callers |
| [ ] | `addProductsToCart` | ~458 | Zero external callers |
| [ ] | `goToAccountPage` | ~504 | Zero external callers |
| [ ] | `openCart` / `closeCart` | ~373, ~384 | Zero external callers |
| [ ] | `newConciergeMedAddProductsToCartUntilMinimumMet` | — | Only referenced in commented code in `live.spec.ts` L114 |
| [ ] | `newLiveMedAddProductsToCartUntilMinimumMet` | — | Only referenced in commented code |

### `models/always-on/account-page.ts`

| Review | Method | Line | Evidence |
|--------|--------|-----:|----------|
| [ ] | `navigateToOrders` | ~206 | Zero callers |
| [ ] | `verifyOrderHistoryLoads` | ~210 | Zero callers |
| [ ] | `verifyImageIsPopulated` | ~457 | Only referenced in commented-out code |

### `models/concierge/concierge-login.ts`

| Review | Method | Evidence |
|--------|--------|----------|
| [ ] | `loginExistingUser` | Zero spec callers; `loginUser` is used instead |

### `models/admin/admin-login-page.ts`

| Review | Method | Evidence |
|--------|--------|----------|
| [ ] | `logout` | Zero callers in tests/utils |
| [ ] | `ensureLoggedIn` | Zero callers; only `login()` is used |

### `models/login-page.ts`

| Review | Item | Evidence |
|--------|------|----------|
| [ ] | Locators `lostPasswordLink`, `rememberMeCheckBox`, `createAccountLink` | Declared but never assigned or used |

### `models/my-account-page.ts`

| Review | Item | Evidence |
|--------|------|----------|
| [ ] | Locators `ordersLink`, `accountDetailsLink`, `cardsLink`, `editShippingAddressLink`, `phone` | Declared, never referenced in methods |

### `models/order-recieved-page.ts`

| Review | Item | Evidence |
|--------|------|----------|
| [ ] | Fields `orderDate`, `productLinks`, `subTotal`, `countyGrossTax`, `californaiExciseTax`, `salesTax` | Declared, never initialized or used |

### `utils/footer-links.ts`

| Review | Export | Evidence |
|--------|--------|----------|
| [ ] | `validateFooterHref` | Exported but only called internally by `assertFooterLinks`; no external importers |

---

## Review Checklist Summary

| Tier | Category | Count | Safe to delete after review? |
|------|----------|------:|------------------------------|
| 1 | Zero-reference files | ~16 files + `k6/` | Yes — git history preserves them |
| 2 | Abandoned / superseded | ~5 files + legacy folder | Confirm with team first |
| 3 | Dead methods in live files | ~15 methods | Remove during refactor PRs |
| — | Unused npm deps | ~8 packages | After removing orphan config chain |
| — | Committed artifacts | ~4 items | Yes — extend `.gitignore` |

**Total estimated deletable tracked content:** ~195 KB (Tier 1) + ~24 KB (Tier 2 if generators retired)
