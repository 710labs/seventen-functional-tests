# Always-On Test Coverage Documentation

## Overview

The "always-on" test suite provides continuous monitoring and verification of production and staging systems that are always accessible. These tests run on a regular schedule to ensure critical user journeys remain functional across different environments and user types.

## Purpose

Always-on tests serve multiple critical functions:

1. **Production Health Monitoring**: Continuous verification that production systems are operational
2. **Regression Detection**: Early detection of breaking changes in critical user flows
3. **Visual Regression**: Screenshot-based comparison to detect UI changes
4. **Multi-Environment Validation**: Testing across dev, staging, and production environments
5. **User Journey Verification**: Ensuring complete end-to-end flows work for both recreational and medical users

## Test Files Overview

### 1. `tests/always-on-tests/live.spec.ts`

**Environment**: Development/Staging Live (`live-dev.710labs.com` or `live.710labs.com`)

**Purpose**: Comprehensive testing of the live/always-on system with full user journey coverage including visual regression.

**Key Features**:
- Full order placement (creates real orders)
- Visual regression testing (46 baseline snapshots)
- Account management testing
- Multi-device support (Desktop and Mobile Chrome)
- Both recreational and medical user flows

**Test Cases**:

#### Recreational New User Happy Path
- **Flow**: Register → Shop → Checkout → Order Confirmation → Account Management → Re-login
- **Coverage**:
  - Homepage pre-login state verification
  - Address entry and validation
  - User registration flow
  - Product browsing and cart management
  - Checkout process with address editing
  - Order placement and confirmation
  - Account page functionality (password update, email update)
  - Logout and re-authentication with updated credentials
- **Visual Regression Points**:
  - Homepage shop pre-login (rec)
  - Auth gateway modal (rec)
  - Homepage post-login (rec)
  - Checkout your info section (rec)
  - Checkout payment section (rec)
  - Order confirmation page (rec)
  - Account page (rec)

#### Medical New User Happy Path
- **Flow**: Register medical user → Shop med-only products → Checkout → Account Management → Re-login
- **Coverage**:
  - Medical user registration
  - Medical product filtering and selection
  - Medical checkout flow
  - Account management for medical users
- **Visual Regression Points**:
  - Home shop by category (med)
  - Auth gateway modal (med)
  - Home post-login title (med)
  - Checkout your info section (med)
  - Checkout payment section (med)
  - Order confirmation page (med)
  - Account personal info header (med)

#### Existing User Sign In/Out
- **Flow**: Login existing user → Verify shop access → Logout
- **Coverage**:
  - Existing user authentication
  - Wrong password error handling
  - Successful login flow
  - Logout functionality
- **Visual Regression Points**:
  - Auth gateway for existing users

**Visual Regression Configuration**:
- **Threshold**: 0.2 (20% per-pixel tolerance)
- **Max Diff Pixels**: 1000
- **Animation Suppression**: CSS animations/transitions disabled before screenshots
- **Masking**: Dynamic content masked (emails, phone numbers, order IDs, personal info)
- **Platform**: macOS-specific baselines (darwin.png suffix)
- **Trigger**: Controlled by `VISUAL` environment variable (`VISUAL=1`)

**Order Management**:
- Order numbers written to `order_ids.txt` for API-based cancellation
- Orders can be cleaned up via API endpoints

---

### 2. `tests/always-on-tests/concierge.spec.ts`

**Environment**: Development/Staging Concierge Portal

**Purpose**: Testing concierge portal functionality including admin user creation and order flows.

**Key Features**:
- Admin-driven user creation via WordPress dashboard
- Concierge-specific login flows
- Full order placement
- Account management

**Test Cases**:

#### Existing User Sign In/Out
- **Flow**: Concierge login → Verify shop access → Logout
- **Coverage**: Concierge authentication and shop accessibility

#### Recreational New User Happy Path
- **Flow**: Admin creates user → Concierge login → Shop → Checkout → Account update → Re-login
- **Coverage**:
  - Admin user creation workflow
  - Concierge login as newly created user
  - Address management in concierge context
  - Product cart and checkout
  - Account updates
  - Re-authentication with updated credentials

#### Medical New User Happy Path
- **Flow**: Admin creates medical user → Concierge login → Shop med products → Checkout → Account update → Re-login
- **Coverage**:
  - Medical user creation via admin
  - Medical product ordering through concierge portal
  - Account management

**User Creation**:
- Uses WordPress admin dashboard for user creation
- Generates unique test emails with timestamps and device type
- Format: `test_auto_{rec|med}_{timestamp}_{deviceType}@test.com`

---

### 3. `tests/always-on-tests/prod-live.spec.ts`

**Environment**: Production Live (`live.710labs.com`)

**Purpose**: Production system smoke test that verifies critical flows WITHOUT placing orders.

**Key Features**:
- **No Order Placement**: Cart is cleared before checkout to avoid creating production orders
- Production system verification
- Existing user authentication
- Cart and checkout page verification

**Test Cases**:

#### Prod Live Check - Existing REC User
- **Flow**: Sign in existing user → Add products → Verify checkout page → Clear cart → Logout
- **Coverage**:
  - Production live system accessibility
  - Existing user login
  - Product addition to cart
  - Checkout page loads correctly
  - Cart clearing functionality
- **Safety**: Cart cleared before checkout to prevent order creation

**Important Notes**:
- Does NOT place orders (intentional safety measure)
- Tests critical path without impacting production data
- Verifies system is operational without creating test orders

---

### 4. `tests/always-on-tests/prod-concierge.spec.ts`

**Environment**: Production Concierge Portal

**Purpose**: Production concierge portal smoke test without order placement.

**Key Features**:
- Production concierge verification
- No order placement
- Cart clearing before checkout

**Test Cases**:

#### Prod Concierge Check - MED EXISTING User
- **Flow**: Concierge login → Add products → Verify checkout → Clear cart → Logout
- **Coverage**:
  - Production concierge portal accessibility
  - Medical user authentication
  - Cart functionality
  - Checkout page verification
- **Safety**: Cart cleared before checkout

---

### 5. `tests/always-on-tests/prod-employee.spec.ts`

**Environment**: Production Employee Store

**Purpose**: Production employee store verification without order placement.

**Key Features**:
- Employee portal testing
- No order placement
- Cart clearing before checkout

**Test Cases**:

#### Prod Employee-Store Check - REC EXISTING User
- **Flow**: Employee portal login → Add products → Verify checkout → Clear cart → Logout
- **Coverage**:
  - Production employee store accessibility
  - Recreational user authentication
  - Cart and checkout verification
- **Safety**: Cart cleared before checkout

---

## User Journeys Covered

### Recreational User Journey

1. **New User Registration**
   - Age gate passage
   - Address entry
   - User registration form completion
   - Email verification (implicit)
   - Account creation confirmation

2. **Shopping Experience**
   - Homepage navigation
   - Product browsing
   - Product selection and cart addition
   - Cart management (add/remove items)
   - Minimum order value verification

3. **Checkout Process**
   - Checkout page navigation
   - Address entry/editing
   - Delivery slot selection (if applicable)
   - Payment method selection
   - Order review and confirmation

4. **Order Confirmation**
   - Order number generation
   - Order details verification
   - Confirmation page display

5. **Account Management**
   - Account page access
   - Password update
   - Email update
   - Address management
   - Order history access

6. **Re-authentication**
   - Logout
   - Re-login with updated credentials
   - Session persistence verification

### Medical User Journey

1. **Medical User Registration**
   - Medical user type selection
   - Medical card information entry
   - Medical card expiration date entry
   - Medical-specific account creation

2. **Medical Product Shopping**
   - Medical-only product filtering
   - Medical product selection
   - Medical cart management

3. **Medical Checkout**
   - Medical checkout flow
   - Medical-specific tax calculations
   - Medical order placement

4. **Medical Account Management**
   - Medical card updates
   - Medical account settings
   - Medical order history

---

## Platform Coverage

### Desktop Chrome
- **Viewport**: Standard desktop resolution
- **Coverage**: All always-on tests
- **Visual Regression**: Desktop-specific baselines

### Mobile Chrome
- **Viewport**: Mobile viewport (typically 375x667 or similar)
- **Coverage**: Most always-on tests (some production tests skip mobile)
- **Visual Regression**: Mobile-specific baselines
- **Device Type Detection**: Tests detect viewport size and adjust behavior accordingly

---

## Critical Checks and Assertions

### Authentication Checks
- User sign-in modal appears when adding products to cart
- Wrong password error handling
- Successful login redirects to shop
- Logout functionality works correctly

### Shop Functionality
- Homepage loads after login
- Products are visible and selectable
- Cart updates correctly when products added
- Minimum order value is enforced

### Checkout Verification
- Checkout page loads correctly
- Address fields are editable
- Delivery slot selection works (when applicable)
- Payment section displays correctly
- Order can be placed successfully

### Order Confirmation
- Order number is generated
- Order confirmation page displays
- Order details are accurate
- Order number is captured for cleanup

### Account Management
- Account page loads correctly
- Password can be updated
- Email can be updated
- Updated credentials work for re-login

### Visual Regression Checks
- Screenshots match baseline images
- Dynamic content is properly masked
- UI elements render correctly
- Responsive design works on mobile

---

## Environment Configuration

### Development/Staging Environments
- **Live**: `live-dev.710labs.com` or `live.710labs.com`
- **Concierge**: Concierge dev/staging portal
- **Behavior**: Full order placement enabled
- **Data**: Test orders created and tracked

### Production Environments
- **Live**: `live.710labs.com` (production)
- **Concierge**: Production concierge portal
- **Employee**: Production employee store
- **Behavior**: Order placement disabled (cart cleared before checkout)
- **Data**: No test orders created

---

## Visual Regression Details

### Implementation Location
- **File**: `tests/always-on-tests/live.spec.ts`
- **Trigger**: `VISUAL` environment variable set to `'1'`
- **Baseline Storage**: `live.spec.ts-snapshots/` directory
- **Total Snapshots**: 46 baseline images

### Screenshot Configuration
```typescript
await expect(page).toHaveScreenshot('screenshot-name.png', {
  threshold: 0.2,        // 20% per-pixel tolerance
  maxDiffPixels: 1000,   // Maximum pixel differences allowed
  mask: [element1, element2]  // Elements to mask
})
```

### Masking Strategy
Dynamic content is masked to prevent false positives:
- User input fields (email, phone, birthday, names)
- Order numbers
- Order confirmation details
- Personal information sections
- Timestamps and appointment times

### Animation Suppression
CSS animations and transitions are disabled before screenshots:
```typescript
await page.addStyleTag({
  content: '*, *::before, *::after { animation: none !important; transition: none !important; } input, textarea { caret-color: transparent !important; }'
})
```

### Current Limitations
- **Platform-Specific**: Baselines are macOS-specific (darwin.png)
- **CI/CD Integration**: Visual tests not currently run in GitHub Actions
- **Coverage**: Only covers `live.spec.ts`, not other test files

---

## Test Execution Configuration

### Timeouts
- **Live Tests**: 500 seconds (8.3 minutes)
- **Concierge Tests**: 200 seconds (3.3 minutes)
- **Production Tests**: 240 seconds (4 minutes)

### Parallel Execution
- All always-on test suites configured for parallel execution
- Tests can run simultaneously for faster execution

### Retry Logic
- CI/CD configured with `retries: 1` for flaky test handling
- Local execution typically runs once

---

## Order Management and Cleanup

### Order Tracking
- Order numbers written to `order_ids.txt` file
- Format: One order number per line
- Used for API-based order cancellation

### Cleanup Strategy
- Orders can be cancelled via API endpoints
- Test users cleaned up automatically after 48 hours (via QA endpoints)
- Production tests avoid creating orders entirely

---

## Integration Points

### API Endpoints
- **QA Endpoint**: `/wp-content/plugins/seventen-qa/api/`
- **User Creation**: `POST /customer` endpoint
- **Order Cancellation**: Via admin API
- **Tax Rate Lookup**: `GET /tax-rates` by ZIP code

### External Services
- **Acuity Scheduling**: Used for pickup slot selection (Michigan)
- **WordPress Admin**: Used for concierge user creation
- **POS System**: Order verification and sync

---

## Best Practices

1. **Production Safety**: Production tests never place orders (cart cleared before checkout)
2. **Visual Regression**: Use consistent masking and threshold values
3. **Test Data**: Use unique identifiers (timestamps, UUIDs) for test users
4. **Error Handling**: Tests handle wrong password scenarios gracefully
5. **Platform Coverage**: Test both desktop and mobile viewports
6. **Order Cleanup**: Always track order IDs for cleanup via API

---

## Future Improvements

1. **CI/CD Integration**: Enable visual regression in GitHub Actions workflows
2. **Linux Baselines**: Create Linux-specific baselines for CI/CD compatibility
3. **Expanded Coverage**: Add visual regression to other test files
4. **Baseline Management**: Implement approval workflow for visual changes
5. **Documentation**: Create visual regression strategy documentation
6. **Threshold Tuning**: Document and justify threshold values

---

## Related Documentation

- [TEST_CASES.MD](TEST_CASES.MD) - Detailed breakdown of all test cases
- [SUMMARY.MD](SUMMARY.MD) - High-level test suite overview
- [visual_regression_analysis_5bb31c76.plan.md](visual_regression_analysis_5bb31c76.plan.md) - Visual regression analysis and recommendations

