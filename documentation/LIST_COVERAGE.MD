# "The List" Test Coverage Documentation

## Overview

"The List" refers to 710 Labs' main direct-to-consumer e-commerce platform, accessible at various state-specific and environment-specific domains. This document outlines all test coverage for "the list" sites and associated functionality.

## What is "The List"?

"The List" is the primary e-commerce platform where customers can:
- Browse and purchase cannabis products
- Create accounts (recreational and medical)
- Place orders for delivery or pickup
- Manage their accounts and order history
- Access age-gated, password-protected content

## Environments and Sites

### Development
- **URL**: `https://thelist-dev.710labs.com`
- **Purpose**: Development and feature testing
- **Configuration**: `configs/dev.config.ts`
- **Features**: Full order placement, test data creation

### Staging
- **URL**: `https://thelist-staging.710labs.com`
- **Purpose**: Pre-production validation
- **Configuration**: `configs/staging.config.ts`
- **Features**: Production-like testing, order placement enabled

### Production (State-Specific)
- **California**: State-specific production domain
- **Florida**: State-specific production domain
- **Michigan**: State-specific production domain
- **Colorado**: State-specific production domain
- **New Jersey**: State-specific production domain
- **Configuration**: `configs/prod-{state}.config.ts` files
- **Features**: Production validation, smoke tests only

## Test Files Covering "The List"

### E2E Order Tests

These tests cover complete end-to-end order flows for each state:

#### `tests/e2e-tests/california-order.spec.ts`
- **States**: California (CA)
- **Coverage**: 
  - New and existing customers
  - Recreational and medical users
  - Delivery fulfillment
  - Tax calculation verification
- **Test Cases**: 4 test cases (new/existing × rec/med)

#### `tests/e2e-tests/florida-order.spec.ts`
- **States**: Florida (FL)
- **Coverage**:
  - Medical customer orders
  - Delivery fulfillment
  - Florida-specific tax calculations
  - Random ZIP code selection
- **Test Cases**: 1 test case (new medical customer)

#### `tests/e2e-tests/michigan-order.spec.ts`
- **States**: Michigan (MI)
- **Coverage**:
  - In-state and out-of-state customers
  - Recreational users
  - Pickup fulfillment with Acuity scheduling
  - Michigan-specific customer creation (ID numbers required)
- **Test Cases**: 2 test cases (in-state/out-of-state)

#### `tests/e2e-tests/colorado-order.spec.ts`
- **States**: Colorado (CO)
- **Coverage**:
  - New and existing customers
  - Recreational and medical users
  - Pickup fulfillment
  - Colorado-specific tax calculations
- **Test Cases**: 4 test cases (new/existing × rec/med)

#### `tests/e2e-tests/new-jersey-order.spec.ts`
- **States**: New Jersey (NJ)
- **Coverage**:
  - New and existing customers
  - Recreational and medical users
  - Pickup fulfillment
  - New Jersey-specific address handling
- **Test Cases**: 4 test cases (new/existing × rec/med)

### Smoke Tests

Quick acceptance tests that verify critical paths including admin operations:

#### `tests/smoke-tests/smoke-test-ca.spec.ts`
- **States**: California
- **Coverage**: Full order flow + admin split + cancellation
- **Platform**: Desktop only

#### `tests/smoke-tests/smoke-test-fl.spec.ts`
- **States**: Florida
- **Coverage**: Medical customer flow + admin operations
- **Platform**: Desktop only

#### `tests/smoke-tests/smoke-test-mi.spec.ts`
- **States**: Michigan
- **Coverage**: Pickup order with Acuity + admin operations
- **Platform**: Desktop only

#### `tests/smoke-tests/smoke-test-co.spec.ts`
- **States**: Colorado
- **Coverage**: Pickup order + admin operations
- **Platform**: Desktop only

#### `tests/smoke-tests/smoke-test-nj.spec.ts`
- **States**: New Jersey
- **Coverage**: Pickup order + admin operations
- **Platform**: Desktop only

### Cart Tests

Tests covering cart functionality and discount logic:

#### `tests/cart-tests/auto-discount-tests.spec.ts`
- **Coverage**: 
  - Account credit functionality
  - Automatic discount application
  - Credit verification in cart
- **Status**: Currently skipped (tests exist but not active)

#### `tests/cart-tests/cart-alerts-tests.spec.ts`
- **Coverage**:
  - Cart reservation timer
  - Timer visibility and text verification
- **States**: CA, MI, CO, NJ
- **Platform**: Desktop and Mobile Chrome

### Gate Tests

Tests covering access control and age verification:

#### `tests/gate-tests/age-gate-tests.spec.ts`
- **Coverage**:
  - Age gate passage (valid)
  - Age gate rejection (invalid)
- **States**: CA, FL, NJ
- **Purpose**: Ensures age verification works correctly

#### `tests/gate-tests/list-password-tests.spec.ts`
- **Coverage**:
  - Valid password entry
  - Invalid password rejection
  - Password protection enforcement
- **States**: CA, FL, CO, NJ
- **Purpose**: Ensures list password protection works

### Admin Tests

Tests covering administrative functionality:

#### `tests/admin-tests/split-orders-tests.spec.ts`
- **Coverage**:
  - Admin order splitting (legacy method)
  - Order detail verification
  - Auto-split functionality (placeholder)
- **States**: CA, CO
- **Platform**: Desktop only

## State-Specific Coverage

### California (CA)
- **E2E Tests**: 4 test cases (full coverage)
- **Smoke Tests**: 1 test case
- **Gate Tests**: Age gate + List password
- **Cart Tests**: Cart alerts
- **Admin Tests**: Order splitting
- **Fulfillment**: Delivery
- **User Types**: Recreational and Medical

### Florida (FL)
- **E2E Tests**: 1 test case (medical)
- **Smoke Tests**: 1 test case
- **Gate Tests**: Age gate + List password
- **Fulfillment**: Delivery
- **User Types**: Medical (primary)
- **Special Features**: Random ZIP code selection

### Michigan (MI)
- **E2E Tests**: 2 test cases (in-state/out-of-state)
- **Smoke Tests**: 1 test case
- **Gate Tests**: List password
- **Cart Tests**: Cart alerts
- **Fulfillment**: Pickup (Acuity scheduling)
- **User Types**: Recreational
- **Special Features**: 
  - ID number requirements for customer creation
  - Acuity integration for pickup scheduling
  - In-state vs out-of-state customer handling

### Colorado (CO)
- **E2E Tests**: 4 test cases (full coverage)
- **Smoke Tests**: 1 test case
- **Gate Tests**: List password
- **Cart Tests**: Cart alerts
- **Admin Tests**: Order splitting
- **Fulfillment**: Pickup
- **User Types**: Recreational and Medical

### New Jersey (NJ)
- **E2E Tests**: 4 test cases (full coverage)
- **Smoke Tests**: 1 test case
- **Gate Tests**: Age gate + List password
- **Cart Tests**: Cart alerts
- **Fulfillment**: Pickup
- **User Types**: Recreational and Medical

## Key Features Tested

### User Account Management
- **New User Registration**: 
  - Recreational users
  - Medical users (with medical card)
  - State-specific requirements (e.g., Michigan ID numbers)
- **Existing User Login**: 
  - Authentication flow
  - Session management
  - Account access

### Product Shopping
- **Product Browsing**: 
  - Product visibility
  - Product selection
  - Category navigation
- **Cart Management**: 
  - Add products to cart
  - Cart timer/reservation
  - Minimum order value enforcement
  - Cart totals calculation

### Checkout Process
- **Address Management**: 
  - Address entry
  - Address editing
  - Address validation
- **Fulfillment Selection**: 
  - Delivery (CA, FL)
  - Pickup (MI, CO, NJ)
  - Acuity slot selection (MI)
- **Tax Calculation**: 
  - State-specific tax rates
  - Medical vs recreational tax differences
  - ZIP code-based tax calculation
- **Payment**: 
  - Payment method selection
  - Order review
  - Order placement

### Order Management
- **Order Confirmation**: 
  - Order number generation
  - Order details verification
  - Order received page
- **Admin Operations**: 
  - Order splitting
  - Order cancellation
  - Order detail access

### Access Control
- **Age Gate**: 
  - Age verification
  - Underage rejection
- **List Password**: 
  - Password protection
  - Valid/invalid password handling

## Configuration Differences

### Development Configuration (`dev.config.ts`)
- **Base URL**: `https://thelist-dev.710labs.com`
- **Timeout**: 15 minutes
- **Slow Motion**: 200ms (for debugging)
- **Video/Screenshots**: Always on
- **Product Orders**: Predefined product combinations for testing
- **Reporters**: Tesults, Slack, S3, GitHub Actions

### Staging Configuration (`staging.config.ts`)
- **Base URL**: `https://thelist-staging.710labs.com`
- **Timeout**: 10 minutes
- **Workers**: 12 (in CI)
- **Product Orders**: Staging-specific products
- **Reporters**: Slack, S3, GitHub Actions

### Production Configurations (`prod-{state}.config.ts`)
- **Base URL**: Environment variable (state-specific)
- **Timeout**: 10 minutes
- **Workers**: 12 (in CI)
- **Product Orders**: Production products
- **Reporters**: Tesults, Slack, S3, GitHub Actions

## Test Data Management

### User Creation
- **API-Driven**: Uses QA endpoints for user creation
- **Faker.js**: Generates realistic test data (names, emails)
- **Unique Identifiers**: UUIDs and timestamps for uniqueness
- **Cleanup**: Automatic cleanup after 48 hours

### Product Selection
- **Predefined Orders**: Config files specify product combinations
- **Random Selection**: Some tests use random product selection
- **State-Specific**: Products vary by state and environment

### Address Data
- **Hardcoded Addresses**: Common test addresses per state
- **ZIP Code Data**: JSON files with valid ZIP codes per state
- **Random Selection**: Florida tests use random ZIP codes

### Tax Calculation
- **ZIP Code Based**: Tax rates fetched by ZIP code
- **State-Specific**: Different tax structures per state
- **Medical vs Recreational**: Different rates for user types
- **Verification**: Cart and checkout totals verified against calculated taxes

## Platform Coverage

### Desktop Chrome
- **Coverage**: All "the list" tests
- **Viewport**: Standard desktop resolution
- **Features**: Full functionality testing

### Mobile Chrome
- **Coverage**: Most E2E and cart tests
- **Viewport**: Pixel 5 (375x667)
- **Exclusions**: Some smoke tests skip mobile
- **Features**: Responsive design verification

## Integration Points

### QA API Endpoints
- **Base Path**: `/wp-content/plugins/seventen-qa/api/`
- **User Creation**: `POST /customer`
- **Tax Rates**: `GET /tax-rates?zipcode={zip}`
- **Product Info**: `GET /product-info`
- **Domain Switching**: `POST /domain` (dev/staging)

### External Services
- **Acuity Scheduling**: Pickup slot selection (Michigan)
- **WordPress Admin**: User management, order management
- **POS System**: Order verification and synchronization

## Test Execution Patterns

### E2E Order Tests
- **Frequency**: On-demand and scheduled (daily)
- **Purpose**: Full order flow validation
- **Order Placement**: Creates real orders
- **Cleanup**: Order IDs tracked for cancellation

### Smoke Tests
- **Frequency**: On-demand (post-deploy, infrastructure changes)
- **Purpose**: Quick validation of critical paths
- **Order Placement**: Creates orders + admin operations
- **Cleanup**: Orders cancelled after test

### Cart Tests
- **Frequency**: On-demand
- **Purpose**: Cart functionality verification
- **Order Placement**: May or may not place orders

### Gate Tests
- **Frequency**: On-demand
- **Purpose**: Access control verification
- **Order Placement**: No orders placed

### Admin Tests
- **Frequency**: On-demand
- **Purpose**: Administrative functionality
- **Order Placement**: Creates orders for splitting

## State-Specific Requirements

### California
- **Medical Cards**: Required for medical users
- **Tax Structure**: Complex multi-tier tax calculation
- **Delivery**: Primary fulfillment method
- **ZIP Codes**: Multiple delivery zones

### Florida
- **Medical Focus**: Primarily medical customers
- **Random ZIP Codes**: Tests use random ZIP selection
- **Delivery**: Primary fulfillment method

### Michigan
- **ID Requirements**: Customer creation requires ID numbers
- **In-State vs Out-of-State**: Different handling
- **Acuity Integration**: Pickup scheduling required
- **Pickup Only**: No delivery option

### Colorado
- **Pickup Focus**: Pickup fulfillment
- **Medical Cards**: Required for medical users
- **Address Data**: Colorado-specific addresses

### New Jersey
- **Pickup Focus**: Pickup fulfillment
- **Medical Cards**: Required for medical users
- **Address Format**: Specific address format requirements

## Coverage Gaps and Limitations

### Current Gaps
1. **Visual Regression**: Not implemented for "the list" tests (only in always-on tests)
2. **Performance Testing**: Artillery config exists but not regularly executed
3. **Error States**: Limited coverage of error scenarios
4. **Edge Cases**: Some edge cases not covered (out of stock, unavailable slots)

### Test Limitations
1. **Mobile Coverage**: Some smoke tests skip mobile
2. **Skipped Tests**: Auto-discount tests currently skipped
3. **Placeholder Tests**: Some admin tests are placeholders

## Related Documentation

- [TEST_CASES.MD](TEST_CASES.MD) - Detailed breakdown of all test cases
- [SUMMARY.MD](SUMMARY.MD) - High-level test suite overview
- [LIVE_COVERAGE.MD](LIVE_COVERAGE.MD) - Always-on test coverage
- [CRON_SCHEDULES.MD](CRON_SCHEDULES.MD) - Automated test execution schedules

