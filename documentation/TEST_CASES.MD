# Test Cases Documentation

This document provides a comprehensive breakdown of all test cases organized by test category and file.

## Table of Contents

- [Always-On Tests](#always-on-tests)
- [E2E Order Tests](#e2e-order-tests)
- [Smoke Tests](#smoke-tests)
- [Cart Tests](#cart-tests)
- [Gate Tests](#gate-tests)
- [Admin Tests](#admin-tests)

---

## Always-On Tests

### `tests/always-on-tests/live.spec.ts`

**Purpose**: Comprehensive testing of the live/always-on production system covering full user journeys for both recreational and medical users.

**Test Cases**:

1. **Rec New User - Happy Path test**
   - Tags: `@recreational`
   - Flow: Register new recreational user → Checkout → Update Account → Re-login with new credentials
   - Coverage:
     - Homepage pre-login state
     - Address entry
     - User registration (rec)
     - Product addition to cart
     - Checkout flow with address editing
     - Order placement and confirmation
     - Account page functionality (password update, email update)
     - Logout and re-login with updated credentials
   - Visual Regression: Includes 8+ screenshot comparisons (homepage, auth gateway, checkout, order confirmation, account page)
   - Platform: Desktop and Mobile Chrome

2. **MED New User - Happy Path test**
   - Tags: `@medical`
   - Flow: Register new medical user → Checkout med-only products → Update Account → Re-login
   - Coverage:
     - Medical user registration
     - Medical product selection and cart
     - Medical checkout flow
     - Account management for medical users
   - Visual Regression: Includes medical-specific screenshots
   - Platform: Desktop and Mobile Chrome

3. **Existing user -- Sign In & Sign Out**
   - Tags: `@recreational`
   - Flow: Login existing user → Verify shop loads → Logout
   - Coverage:
     - Existing user authentication
     - Wrong password handling
     - Successful login flow
     - Logout functionality
   - Visual Regression: Auth gateway screenshot comparison

### `tests/always-on-tests/concierge.spec.ts`

**Purpose**: Testing concierge portal functionality for both recreational and medical user creation and order flows.

**Test Cases**:

1. **Existing user -- Sign In & Sign Out**
   - Tags: `@recreational`
   - Flow: Concierge login → Verify shop loads → Logout
   - Coverage: Concierge authentication and shop access

2. **Rec New User - Happy Path test**
   - Tags: `@recreational`
   - Flow: Admin creates new user → Login as new user → Place order → Update account → Re-login
   - Coverage:
     - Admin user creation via WordPress dashboard
     - Concierge login flow
     - Address management
     - Product cart and checkout
     - Account updates
   - Platform: Desktop and Mobile Chrome

3. **MED New User - Happy Path test**
   - Tags: `@medical`
   - Flow: Admin creates medical user → Login → Place medical order → Update account → Re-login
   - Coverage:
     - Medical user creation via admin
     - Medical product ordering
     - Account management

### `tests/always-on-tests/prod-live.spec.ts`

**Purpose**: Production live system verification - smoke test that does NOT place orders.

**Test Cases**:

1. **Prod Live check - EXISTING REC User**
   - Tags: `@medical` (note: tag mismatch, tests rec user)
   - Flow: Sign in existing user → Add products to cart → Verify checkout → Clear cart → Logout
   - Coverage:
     - Production live system accessibility
     - Existing user login
     - Cart functionality
     - Checkout page verification
   - **Important**: Does NOT place orders (cart cleared before checkout)

### `tests/always-on-tests/prod-concierge.spec.ts`

**Purpose**: Production concierge portal verification - smoke test without order placement.

**Test Cases**:

1. **Prod Concierge check - MED EXISTING User**
   - Tags: `@medical`
   - Flow: Concierge login → Add products → Verify checkout → Clear cart → Logout
   - Coverage: Production concierge portal functionality
   - **Important**: Does NOT place orders

### `tests/always-on-tests/prod-employee.spec.ts`

**Purpose**: Production employee store verification - smoke test without order placement.

**Test Cases**:

1. **Prod Employee-Store check - REC EXISTING User**
   - Tags: `@medical` (note: tag mismatch, tests rec user)
   - Flow: Employee portal login → Add products → Verify checkout → Clear cart → Logout
   - Coverage: Production employee store functionality
   - **Important**: Does NOT place orders

---

## E2E Order Tests

### `tests/e2e-tests/california-order.spec.ts`

**Purpose**: Full end-to-end order flows for California covering all customer types and user types.

**Test Cases**:

1. **Basic Order - Existing Customer - Medical**
   - Tags: `@medical`, `@CA`
   - Flow: Age gate → List password → Login existing medical user → Add medical card → Add products → Verify cart → Checkout → Order confirmation
   - Coverage:
     - Medical customer authentication
     - Medical card/expiration handling
     - Delivery fulfillment
     - Tax calculation verification
   - Platform: Desktop and Mobile Chrome

2. **Basic Order - New Customer - Medical**
   - Tags: `@medical`, `@CA`
   - Flow: Age gate → List password → Create new medical account → Add products → Verify cart → Checkout
   - Coverage:
     - New medical user registration
     - Address entry during registration
     - Medical product ordering
   - Platform: Desktop and Mobile Chrome

3. **Basic Order - Existing Customer - Recreational**
   - Tags: `@recreational`, `@CA`
   - Flow: Age gate → List password → Login existing rec user → Add products → Verify cart → Checkout
   - Coverage:
     - Recreational customer flow
     - Delivery fulfillment
     - Tax calculation (recreational rates)
   - Platform: Desktop and Mobile Chrome

4. **Basic Order - New Customer - Recreational**
   - Tags: `@recreational`, `@CA`
   - Flow: Age gate → List password → Create new rec account → Add products → Verify cart → Checkout
   - Coverage:
     - New recreational user registration
     - Full order flow for new users
   - Platform: Desktop and Mobile Chrome

### `tests/e2e-tests/florida-order.spec.ts`

**Purpose**: End-to-end order flow for Florida medical customers.

**Test Cases**:

1. **Basic Order - New Customer - Medical**
   - Tags: `@medical`, `@FL`
   - Flow: Age gate → List password → Create account → Add products → Verify cart → Checkout
   - Coverage:
     - Florida-specific address handling
     - Medical customer registration
     - Delivery fulfillment
     - Tax calculation for Florida
   - Platform: Desktop and Mobile Chrome
   - Note: Uses random ZIP code selection from Florida ZIP code data

### `tests/e2e-tests/michigan-order.spec.ts`

**Purpose**: End-to-end order flows for Michigan covering in-state and out-of-state customers.

**Test Cases**:

1. **Basic Order - New Customer - In State - Recreational**
   - Tags: `@recreational`, `@InState`, `@MI`
   - Flow: Age gate → List password → Create Michigan customer → Add products → Select Acuity slot → Place order
   - Coverage:
     - Michigan-specific customer creation (requires ID numbers)
     - Pickup fulfillment (Acuity scheduling)
     - In-state customer handling
   - Platform: Desktop only (mobile skipped)
   - Note: Uses step-based test structure

2. **Basic Order - New Customer - Out Of State - Recreational**
   - Tags: `@recreational`, `@OutOfState`, `@MI`
   - Flow: Age gate → List password → Create out-of-state customer → Add products → Select Acuity slot → Place order
   - Coverage:
     - Out-of-state customer registration
     - Pickup scheduling
     - Address validation for non-Michigan addresses
   - Platform: Desktop only

### `tests/e2e-tests/colorado-order.spec.ts`

**Purpose**: Full end-to-end order flows for Colorado covering all customer types.

**Test Cases**:

1. **Basic Order - Existing Customer - Medical**
   - Tags: `@medical`, `@CO`
   - Flow: Age gate → List password → Login existing medical user → Add medical card → Add products (pickup) → Verify cart → Checkout
   - Coverage:
     - Medical customer authentication
     - Pickup fulfillment
     - Colorado-specific tax calculation
   - Platform: Desktop and Mobile Chrome

2. **Basic Order - New Customer - Medical**
   - Tags: `@medical`, `@CO`
   - Flow: Age gate → List password → Create new medical account → Add products (pickup) → Verify cart → Checkout
   - Coverage: New medical user registration with pickup

3. **Basic Order - Existing Customer - Recreational**
   - Tags: `@recreational`, `@CO`
   - Flow: Age gate → List password → Login existing rec user → Add products (pickup) → Verify cart → Checkout
   - Coverage: Recreational customer pickup orders

4. **Basic Order - New Customer - Recreational**
   - Tags: `@recreational`, `@CO`
   - Flow: Age gate → List password → Create new rec account → Add products (pickup) → Verify cart → Checkout
   - Coverage: New recreational user pickup orders

### `tests/e2e-tests/new-jersey-order.spec.ts`

**Purpose**: Full end-to-end order flows for New Jersey covering all customer types.

**Test Cases**:

1. **Basic Order - Existing Customer - Medical**
   - Tags: `@medical`, `@NJ`
   - Flow: Age gate → List password → Login existing medical user → Add medical card → Add products (pickup) → Verify cart → Checkout
   - Coverage:
     - Medical customer authentication
     - Pickup fulfillment
     - New Jersey-specific address handling
   - Platform: Desktop and Mobile Chrome

2. **Basic Order - New Customer - Medical**
   - Tags: `@medical`, `@NJ`
   - Flow: Age gate → List password → Create new medical account → Add products (pickup) → Verify cart → Checkout
   - Coverage: New medical user registration

3. **Basic Order - Existing Customer - Recreational**
   - Tags: `@recreational`, `@NJ`
   - Flow: Age gate → List password → Login existing rec user → Add products (pickup) → Verify cart → Checkout
   - Coverage: Recreational customer pickup orders

4. **Basic Order - New Customer - Recreational**
   - Tags: `@recreational`, `@NJ`
   - Flow: Age gate → List password → Create new rec account → Add products (pickup) → Verify cart → Checkout
   - Coverage: New recreational user pickup orders

---

## Smoke Tests

### `tests/smoke-tests/smoke-test-ca.spec.ts`

**Purpose**: Quick acceptance test for California covering full order flow including admin operations.

**Test Cases**:

1. **Basic Acceptance Test**
   - Tags: `@smoke`
   - Flow: Age gate → List password → Create account → Add products → Checkout → Order confirmation → Logout → Admin login → Split order → Cancel orders
   - Coverage:
     - Full order creation
     - Order verification on `/order-received`
     - Admin order splitting (legacy split)
     - Order cancellation
   - Platform: Desktop only (mobile skipped)
   - Note: Writes order IDs to files for cleanup

### `tests/smoke-tests/smoke-test-fl.spec.ts`

**Purpose**: Quick acceptance test for Florida covering full order flow including admin operations.

**Test Cases**:

1. **Basic Acceptance Test**
   - Tags: `@smoke`
   - Flow: Age gate → List password → Create account → Add products → Checkout → Order confirmation → Logout → Admin login → Split order → Cancel orders
   - Coverage:
     - Florida medical customer flow
     - Random ZIP code selection
     - Admin order splitting
     - Order cancellation
   - Platform: Desktop only

### `tests/smoke-tests/smoke-test-mi.spec.ts`

**Purpose**: Quick acceptance test for Michigan covering pickup order flow with Acuity scheduling.

**Test Cases**:

1. **Basic Acceptance Test**
   - Tags: `@smoke`
   - Flow: Age gate → List password → Create Michigan customer → Add products → Select Acuity slot → Place order → Order confirmation → Logout → Admin login → Split order → Cancel orders
   - Coverage:
     - Michigan customer creation (with ID numbers)
     - Pickup fulfillment with Acuity integration
     - Admin operations
   - Platform: Desktop only

### `tests/smoke-tests/smoke-test-co.spec.ts`

**Purpose**: Quick acceptance test for Colorado covering pickup order flow.

**Test Cases**:

1. **Basic Acceptance Test**
   - Tags: `@smoke`
   - Flow: Age gate → List password → Create account → Add products (pickup) → Checkout → Order confirmation → Logout → Admin login → Split order → Cancel orders
   - Coverage:
     - Colorado pickup orders
     - Random address selection from Colorado addresses
     - Admin operations
   - Platform: Desktop only

### `tests/smoke-tests/smoke-test-nj.spec.ts`

**Purpose**: Quick acceptance test for New Jersey covering pickup order flow.

**Test Cases**:

1. **Basic Acceptance Test**
   - Tags: `@smoke`
   - Flow: Age gate → List password → Create account → Add products (pickup) → Checkout → Order confirmation → Logout → Admin login → Split order
   - Coverage:
     - New Jersey pickup orders
     - Admin order splitting
   - Platform: Desktop only
   - Note: Order cancellation is commented out

---

## Cart Tests

### `tests/cart-tests/auto-discount-tests.spec.ts`

**Purpose**: Testing automatic discount application for customers with account credit.

**Test Cases**:

1. **Customer Has Credit - Discount Applied** (SKIPPED)
   - Tags: `@CA`
   - Flow: Create account → Admin adds credit → Login → Add products → Verify credit discount in cart
   - Coverage:
     - Account credit functionality
     - Automatic discount application
     - Credit verification in cart
   - Status: Currently skipped

2. **Customer Has Credit - Order Total Equals Rec Limit - Discount Applied** (SKIPPED)
   - Tags: None
   - Flow: Login existing account with credit → Add products → Verify credit discount
   - Coverage: Credit discount when order total equals recreational limit
   - Status: Currently skipped

### `tests/cart-tests/cart-alerts-tests.spec.ts`

**Purpose**: Testing cart timer and reservation functionality.

**Test Cases**:

1. **Cart Timer Is Visible**
   - Tags: `@MI`, `@CA`, `@CO`, `@NJ`
   - Flow: Create account → Login → Add products to cart → Verify cart timer appears
   - Coverage:
     - Cart reservation timer display
     - Timer text verification ("Your cart is reserved for...")
   - Platform: Desktop and Mobile Chrome

---

## Gate Tests

### `tests/gate-tests/age-gate-tests.spec.ts`

**Purpose**: Testing age gate functionality for age verification.

**Test Cases**:

1. **Accept Age Gate - Valid**
   - Tags: `@CA`, `@FL`, `@NJ`
   - Flow: Navigate to site → Pass age gate → Verify access granted
   - Coverage: Successful age gate passage

2. **Accept Age Gate - Invalid**
   - Tags: `@CA`, `@FL`, `@NJ`
   - Flow: Navigate to site → Fail age gate → Verify access denied
   - Coverage: Age gate rejection for underage users

### `tests/gate-tests/list-password-tests.spec.ts`

**Purpose**: Testing list password protection functionality.

**Test Cases**:

1. **Enter List Password - Valid**
   - Tags: `@CA`, `@FL`, `@CO`, `@NJ`
   - Flow: Pass age gate → Enter correct password → Verify redirect to `/my-account/`
   - Coverage: Successful password entry and site access

2. **Enter List Password - Invalid**
   - Tags: `@CA`, `@FL`, `@CO`, `@NJ`
   - Flow: Pass age gate → Enter incorrect password → Verify access denied
   - Coverage: Password protection enforcement

---

## Admin Tests

### `tests/admin-tests/split-orders-tests.spec.ts`

**Purpose**: Testing admin order splitting functionality.

**Test Cases**:

1. **Admin Can Split Order - Legacy Split**
   - Tags: `@CA`, `@CO`
   - Flow: Create account → Place order → Logout → Admin login → Split order → Verify split
   - Coverage:
     - Admin order splitting functionality
     - Legacy split method
     - Order detail verification
   - Platform: Desktop only

2. **Admin Can Split Order - Auto Split** (SKIPPED)
   - Tags: `@CA`
   - Flow: Create account → Place order → Admin auto-split order
   - Coverage: Automatic order splitting functionality
   - Status: Currently skipped

3. **Auto Assign Fulfilment - New Customer - No Previous Orders - Defaults to Pickup** (SKIPPED)
   - Status: Placeholder test, not implemented

4. **Auto Assign Fulfilment - Existing Customer - Previous Order Pickup - Defaults to Pickup** (SKIPPED)
   - Status: Placeholder test, not implemented

5. **Auto Assign Fulfilment - Existing Customer - Previous Order Delivery - Defaults to Delivery** (SKIPPED)
   - Status: Placeholder test, not implemented

---

## Test Coverage Summary

### By State
- **California (CA)**: 4 E2E tests, 1 smoke test, multiple always-on tests
- **Florida (FL)**: 1 E2E test, 1 smoke test
- **Michigan (MI)**: 2 E2E tests (in-state/out-of-state), 1 smoke test
- **Colorado (CO)**: 4 E2E tests, 1 smoke test
- **New Jersey (NJ)**: 4 E2E tests, 1 smoke test

### By User Type
- **Recreational**: Covered in all states
- **Medical**: Covered in all states (requires medical card handling)

### By Customer Type
- **New Customers**: Registration and first-order flows
- **Existing Customers**: Login and repeat-order flows

### By Fulfillment Type
- **Delivery**: CA, FL (primary)
- **Pickup**: MI, CO, NJ (with Acuity scheduling for MI)

### By Platform
- **Desktop Chrome**: All tests
- **Mobile Chrome**: Most tests (some smoke tests skip mobile)

---

## Test Execution Notes

- **Parallel Execution**: Most test suites configured for parallel execution
- **Timeouts**: Range from 200-500 seconds depending on test complexity
- **Test Data**: Uses API endpoints for user creation, Faker.js for test data generation
- **Order Cleanup**: Order IDs written to files for API-based cancellation
- **Visual Regression**: Implemented in `live.spec.ts` (controlled by `VISUAL` env variable)

