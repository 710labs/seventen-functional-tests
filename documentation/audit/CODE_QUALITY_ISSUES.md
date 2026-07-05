# Code Quality Issues

Anti-patterns, tooling gaps, and maintainability issues found across the test suite. Counts were verified via repo grep (July 2026).

---

## 1. Hardcoded Waits (`waitForTimeout`)

**Severity: High** — Primary source of flakiness and slow test runs.

### Count by File

| File | Count |
|------|------:|
| `models/always-on/checkout-page.ts` | 55 |
| `models/always-on/homepage-actions.ts` | 45 |
| `models/shop-page.ts` | 25 |
| `models/create-account-page.ts` | 22 |
| `models/always-on/account-page.ts` | 13 |
| `models/admin-drop/focused-rules-storefront-page.ts` | 8 |
| `models/checkout-page.ts` | 6 |
| `models/always-on/login-homepage.ts` | 2 |
| `models/concierge/concierge-create-user.ts` | 2 |
| `models/scheduling-page.ts` | 1 |
| `models/my-account-page.ts` | 1 |
| `models/always-on/order-confirmation.ts` | 1 |
| `models/concierge/concierge-login.ts` | 1 |
| **Total in models/** | **~182** |

### Worst Offenders

| Location | Wait | Issue |
|----------|------|-------|
| `models/scheduling-page.ts` L25 | 10,000ms | Entire file is orphaned |
| `models/always-on/homepage-actions.ts` L1408 | 10,000ms | Inside cart-minimum loop |
| `models/create-account-page.ts` | Multiple 5,000ms | Registration form steps |
| `utils/generators/acuity-dev-data.spec.ts` | 12,000ms / 20,000ms | Legacy generator |

### Recommended Fix

Replace with Playwright auto-waiting locators:

```typescript
// Before
await page.waitForTimeout(5000)
await page.click('#submit')

// After
await expect(page.locator('#submit')).toBeEnabled()
await page.locator('#submit').click()
```

---

## 2. Mixed Module Systems (ESM + CommonJS)

**Severity: Medium** — Inconsistent import styles; some files use both patterns.

### Affected Files (9 models use `export` + `module.exports`)

| File |
|------|
| `models/age-gate-page.ts` |
| `models/list-password-protect-page.ts` |
| `models/always-on/login-homepage.ts` |
| `models/always-on/homepage-actions.ts` |
| `models/always-on/checkout-page.ts` |
| `models/always-on/account-page.ts` |
| `models/always-on/order-confirmation.ts` |
| `models/concierge/concierge-login.ts` |
| `models/concierge/concierge-create-user.ts` |

### Import Style Inconsistency

- Always-on tests import with `.ts` extension: `import { X } from '../../models/always-on/checkout-page.ts'`
- Legacy tests omit extension: `import { X } from '../../models/age-gate-page'`

### Recommended Fix

Remove all `module.exports` lines. Standardize on ESM `export` only. Drop `.ts` extensions from imports.

---

## 3. Hardcoded Credentials and Test Data

**Severity: High** — Security and maintainability risk.

| Pattern | Occurrences | Files |
|---------|-------------|-------|
| Password `'test1234'` | Widespread | All smoke specs, most e2e specs, admin-drop tests, POS generator |
| Email domain `test710labstest.com` | Widespread | Smoke, e2e, generators |
| Email domain `710labs-test.com` | Some | Always-on tests |
| Disposable email `account-credit-300@mail7.io` | 1 | `auto-discount-tests.spec.ts` (skipped) |
| Hardcoded expected address `2919 S La Cienega Blvd, Culver City, CA 90232` | 2 | `always-on/checkout-page.ts` L162, L656 |

### Recommended Fix

```typescript
// utils/test-env.ts
export const testEnv = {
  checkoutPassword: process.env.CHECKOUT_PASSWORD ?? 'test1234',
  testEmailDomain: process.env.TEST_EMAIL_DOMAIN ?? 'test710labstest.com',
}
```

---

## 4. File Writes from Parallel Tests

**Severity: High** — Race conditions when tests run in parallel.

| File | Written by | Issue |
|------|-----------|-------|
| `order_id.txt` | 5 smoke specs, `live.spec.ts` | Single file overwritten; gitignored but historically committed |
| `order_ids.txt` | `smoke-test-ca.spec.ts`, `live.spec.ts` | Append mode — race-prone in parallel |

```typescript
// Current pattern (smoke-test-mi.spec.ts)
writeFileSync('order_id.txt', String(orderNumber), { encoding: 'utf-8' })
```

### Recommended Fix

```typescript
// Use Playwright test attachments
await testInfo.attach('order-id', { body: String(orderNumber), contentType: 'text/plain' })

// Or QA API teardown hook in fixture
```

---

## 5. Missing Spec-Level Assertions

**Severity: Medium** — E2E order tests have zero `expect()` calls in spec files.

| Spec group | `expect()` in spec? | Where assertions live |
|------------|--------------------|-----------------------|
| `tests/e2e-tests/*-order.spec.ts` | **No** | Page objects only (`verifyCart`, `confirmCheckout`) |
| `tests/smoke-tests/*.spec.ts` | Yes (order number) | Spec + page objects |
| `tests/always-on-tests/*.spec.ts` | Partial | Mix of spec and page objects |

**Risk:** Tests can pass at the spec level even if page object assertions are incomplete or skipped internally.

### Recommended Fix

Add at minimum one spec-level assertion per test:

```typescript
await test.step('Confirm order placed', async () => {
  const orderNumber = await orderReceived.getOrderNumber()
  await expect(orderNumber, 'Failed to create order').not.toBeNull()
})
```

---

## 6. Tag Taxonomy Gaps

**Severity: Medium** — CI `--grep @XX` runs silently skip relevant tests.

### Smoke Tests Missing State Tags

| File | Tags present | Missing |
|------|-------------|---------|
| `smoke-test-ca.spec.ts` | `@rec`, `@smoke` | `@CA` |
| `smoke-test-co.spec.ts` | `@medical`, `@smoke` | `@CO` |
| `smoke-test-mi.spec.ts` | `@recreational`, `@smoke` | `@MI` |
| `smoke-test-nj.spec.ts` | `@medical`, `@smoke` | `@NJ` |
| `smoke-test-fl.spec.ts` | `@smoke` only | `@FL`, `@medical` |

**Impact:** `ci:test:dev:co` does not run any smoke tests.

### Gate Tests Missing State Tags

| File | Tags present | Missing |
|------|-------------|---------|
| `age-gate-tests.spec.ts` | `@CA`, `@FL`, `@NJ` | `@CO`, `@MI` |
| `list-password-tests.spec.ts` | `@CA`, `@FL`, `@CO`, `@NJ` | `@MI` |

**Impact:** `ci:test:dev:mi` does not run age-gate or list-password tests.

### Inconsistent Usage Tags

| Tag | Used by |
|-----|---------|
| `@rec` | `smoke-test-ca.spec.ts` |
| `@recreational` | MI smoke, always-on tests, e2e tests |
| `@medical` | CO, NJ, FL smoke; e2e tests |

### Recommended Fix

Normalize to `@recreational` / `@medical` and add `@CA`/`@CO`/`@MI`/`@NJ`/`@FL` to all state-specific tests.

---

## 7. Broken Lint and Format Tooling

**Severity: Medium** — No automated code quality enforcement.

| File | Issue |
|------|-------|
| `eslintrc.json` | Missing leading dot — should be `.eslintrc.json`. Not picked up by ESLint. |
| `prettierrc.json` | Missing leading dot — should be `.prettierrc.json`. Not picked up by Prettier. |
| `package.json` `"prettier"` block | **Actually used** by Prettier (tabWidth: 2) |
| `prettierrc.json` content | tabWidth: 4 — **conflicts** with package.json if ever activated |
| ESLint packages | **Not installed** — `eslint`, `eslint-config-prettier`, `eslint-plugin-prettier` absent from `package.json` |
| `package.json` scripts | **No `lint` script** |

### Recommended Fix

1. Rename `eslintrc.json` → `.eslintrc.json` and `prettierrc.json` → `.prettierrc.json` (or delete prettierrc and rely on package.json block).
2. Add eslint packages and a `lint` script.
3. Add lint step to CI PR validation.

---

## 8. Hardcoded Secrets in Configs

**Severity: High** — Tesults JWT token duplicated in source.

Present in: `playwright.config.ts` (orphaned), `configs/dev.config.ts`, `configs/prod-ca.config.ts`, `configs/prod-co.config.ts`, `configs/prod-fl.config.ts`, `configs/prod-mi.config.ts`, `configs/liveandconcierge.config.ts`.

### Recommended Fix

```typescript
// configs/shared/reporters.ts
['playwright-tesults-reporter', { token: process.env.TESULTS_TOKEN }]
```

Add `TESULTS_TOKEN` to GitHub Actions secrets and `.env.example`.

---

## 9. Brittle Selectors

**Severity: Medium** — Tests break on minor UI changes.

| Pattern | Example location | Risk |
|---------|-----------------|------|
| XPath with inline styles | `models/always-on/order-confirmation.ts` L13–15 | Breaks on style changes |
| `text=` selectors | Throughout models | Breaks on copy changes |
| Hardcoded Google Places result | `always-on/checkout-page.ts` | Not parameterized per environment |
| Empty locator | `models/shop-page.ts` L1299 `page.locator(``)` | **Bug** — will always fail |
| CSS fragment selectors | `text=Logout`, `text=create an account` | Fragile |

### Recommended Fix

Prefer `getByRole`, `getByLabel`, `getByTestId` (if app adds test IDs):

```typescript
// Before
await page.click("text=I'm over 21 or a qualified patient")

// After
await page.getByRole('button', { name: "I'm over 21 or a qualified patient", exact: true }).click()
```

---

## 10. Typo Inventory

**Severity: Low** — Cosmetic but signals lack of review; some affect file imports.

| Typo | Location | Type |
|------|----------|------|
| `order-recieved-page.ts` | Filename + step text `"Verify Order Recieved Totals"` | Filename + string |
| `californaiExciseTax` | `models/order-recieved-page.ts` L12 | Field name |
| `Passowrd` | `models/create-account-page.ts` (4×) | Step name string |
| `dispalyedPhotoID*`, `dispalyedMedID*` | `models/always-on/account-page.ts` | Locator names |
| `orderQuanity` | `models/admin/edit-order-page.ts`, legacy spec | Parameter name |
| `cusomers` | `models/admin/edit-profile-page.ts` L11 | Step text |
| `coloradoAddressess` | `utils/data-generator.ts` | Export name (double 's') |
| `Delevery` | `legacy-tests/split-orders-tests.spec.ts` | Test title |
| `Previou` | `legacy-tests/split-orders-tests.spec.ts` | Test title |
| `Comfirm` | `smoke-test-mi.spec.ts` step name | Step text |
| `actiontimeout` | `configs/local.config.ts` | Config key (should be `actionTimeout`) |

---

## 11. `var` Instead of `const`/`let`

**Severity: Low** — Widespread in older specs.

Affected files: all smoke specs, all e2e specs, always-on specs, generators, legacy tests.

```typescript
// Current
var fakeFirstName = faker.name.firstName() + '_Test'
var orderNumber: any

// Preferred
const fakeFirstName = faker.name.firstName() + '_Test'
let orderNumber: string | null
```

---

## 12. `any` Types

**Severity: Low** — Reduces TypeScript safety.

| File | Examples |
|------|----------|
| `models/cart-page.ts` | `Promise<any>`, `any[]` on `cartItems` |
| `models/order-recieved-page.ts` | `any` on order fields |
| `models/shop-page.ts` | `browserName: any` |
| `models/checkout-page.ts` | `any` on cart/tax fields |
| Smoke/e2e specs | `var orderNumber: any`, `var cartTotals: any` |

---

## 13. Console.log Debugging

**Severity: Low** — Noise in CI output.

| File | Approx. count |
|------|-------------|
| `models/always-on/homepage-actions.ts` | ~80 |
| `models/always-on/checkout-page.ts` | ~15 |
| `models/always-on/account-page.ts` | ~10 |
| `models/always-on/login-homepage.ts` | ~5 |
| Smoke specs | 1 each (`✅ Wrote order_id.txt`) |
| Always-on specs | describe-level URL logging at load time |

`homepage-actions.ts` also has a `debugLog` wrapper and `setTimeout` in a debug helper (L20).

---

## 14. Dual Test Harness

**Severity: Low** — Inconsistent test entry points.

| Import | Used by |
|--------|---------|
| `import { test } from '@playwright/test'` | gate-tests, some admin tests |
| `import { test } from '../../options'` | e2e, smoke, cart, admin-drop tests |

`options.ts` extends base test with `qaClient`, `domainState`, `orders` fixtures. Gate tests miss these fixtures unnecessarily.

---

## 15. CI / Config Quality Issues

| Issue | Location | Impact |
|-------|----------|--------|
| `smoke:test:dev:ca` uses `prod-ca.config.ts` | `package.json` L28 | Misleading — runs prod config against dev URL |
| FL/NJ absent from PR validation | `.github/workflows/seventen-thelist-pull-request-validation.yml` | PRs don't gate FL/NJ |
| Node 20 vs 22 drift | POS transmit workflows vs Playwright workflows | Minor inconsistency |
| QA endpoint drift | Acuity workflow uses legacy `/wp-content/plugins/seventen-qa/api/` | Other workflows use REST `/wp-json/seventen-qa/v1/` |
| Duplicate S3 upload paths | In-config reporter + `scripts/upload-playwright-report-s3.js` | Two ways to upload reports |
| `configs/local.config.ts` unused `uuid` import | L1 | Dead import |
| Orphaned configs `testDir: './../tests'` | Root `playwright.config.ts`, `local.config.ts` | Resolves outside repo |

---

## 16. Documentation Staleness

| File | Issue |
|------|-------|
| `documentation/LIST_COVERAGE.MD` | URL `thelist-staging.710labs.com` — codebase uses `thelist-stage.710labs.com` |
| `documentation/SUMMARY.MD` | References non-existent plan file |
| `documentation/CRON_SCHEDULES.MD` | Lists "Old" workflows without deprecation markers |
| `documentation/TEST_CASES.MD` | May lag behind current spec count; includes skipped auto-discount tests |
| `documentation/` (general) | No load-testing section |

---

## Quality Issue Priority Matrix

| Issue | Severity | Effort to fix | Phase |
|-------|----------|---------------|-------|
| Hardcoded waits (182×) | High | High | 4 |
| Hardcoded credentials | High | Low | 2 |
| File writes from parallel tests | High | Low | 2 |
| Hardcoded Tesults token | High | Low | 5 |
| Tag taxonomy gaps | Medium | Low | 2 |
| Broken lint/format config | Medium | Low | 0 |
| Missing spec-level assertions | Medium | Low | 3 |
| Brittle selectors | Medium | Medium | 4 |
| Mixed module systems | Medium | Low | 4 |
| Console.log noise | Low | Low | 4 |
| Typo inventory | Low | Low | 4 |
| `var` / `any` types | Low | Medium | 4 |
| Documentation staleness | Low | Low | 0 |
