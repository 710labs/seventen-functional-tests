# Cron Schedules & Automated Test Execution

This document outlines all scheduled automated test executions, their frequencies, purposes, and integrations.

## Overview

The test suite uses GitHub Actions workflows with cron schedules to automate test execution. Most workflows also support manual triggering via `workflow_dispatch` for on-demand testing.

## Active Scheduled Workflows

### 1. Live Dev - Always-On Tests

**Workflow**: `live-dev.yml`  
**Schedule**: Daily at 11:00 UTC (`'0 11 * * *'`)  
**Time (PST)**: 3:00 AM PST / 4:00 AM PDT  
**Purpose**: Continuous monitoring of development live/always-on system

**What It Tests**:
- Live dev environment (`live-dev.710labs.com`)
- Full user journeys (recreational and medical)
- Order placement and confirmation
- Account management
- Visual regression (when `VISUAL=1`)

**Key Features**:
- Creates real orders in dev environment
- Collects order IDs for POS verification
- Includes POS instance sync verification job
- Uploads Playwright reports to artifacts
- Sends Slack notifications

**Post-Test Actions**:
- Order IDs collected and verified against POS system
- POS sync verification runs for each order created
- Reports archived to S3
- Slack notifications sent to `#tech-savagery-tests` and `#710labs-qatest-results`

---

### 2. Concierge Dev - Always-On Tests

**Workflow**: `concierge-dev.yml`  
**Schedule**: Daily at 11:00 UTC (`'0 11 * * *'`)  
**Time (PST)**: 3:00 AM PST / 4:00 AM PDT  
**Purpose**: Continuous monitoring of development concierge portal

**What It Tests**:
- Concierge dev environment (`concierge-dev.710labs.com`)
- Admin user creation workflow
- Concierge login and shop access
- Order placement through concierge portal
- Account management

**Key Features**:
- Tests admin-driven user creation
- Verifies concierge-specific flows
- Creates orders via concierge portal
- Uploads Playwright reports

**Post-Test Actions**:
- Reports archived to S3
- Slack notifications sent

---

### 3. The List Dev - Functional Tests (All States)

**Workflow**: `seventen-thelist-dev-functional-tests.yml`  
**Schedule**: Daily at 14:00 UTC (`'0 14 * * *'`)  
**Time (PST)**: 6:00 AM PST / 7:00 AM PDT  
**Purpose**: Comprehensive functional testing of "the list" dev environment across all states

**What It Tests**:
- Development environment (`thelist-dev.710labs.com`)
- All 5 states: CA, FL, MI, CO, NJ (sequential execution)
- E2E order flows for each state
- State-specific configurations and tax calculations

**Execution Flow**:
1. **CA Tests** → Sets domain to CA → Runs CA E2E tests
2. **FL Tests** → Sets domain to FL → Runs FL E2E tests (after CA completes)
3. **MI Tests** → Sets domain to MI → Runs MI E2E tests (after FL completes)
4. **CO Tests** → Sets domain to CO → Runs CO E2E tests (after MI completes)
5. **NJ Tests** → Sets domain to NJ → Runs NJ E2E tests (after CO completes)

**Key Features**:
- Sequential execution (each state waits for previous to complete)
- State domain switching via API before each test suite
- Can be manually triggered with state selection (all states enabled by default)
- Continues execution even if a state fails (`always()` condition)

**Manual Trigger Options**:
- Can select which states to run via workflow dispatch inputs
- Default: All states enabled
- Useful for testing specific states after deployments

**Post-Test Actions**:
- Reports archived to S3
- Slack notifications sent
- Test results available in GitHub Actions

---

### 4. Live PROD - POS Order Transmission Check

**Workflow**: `live-transmission-check.yml`  
**Schedule**: Daily at 10:00 UTC (`'0 10 * * *'`)  
**Time (PST)**: 2:00 AM PST / 3:00 AM PDT  
**Purpose**: Verify that orders are properly syncing to POS instances

**What It Checks**:
- Last 10 orders from live dev environment
- Verifies required POS fields are populated:
  - `instanceId` / `instanceID`
  - `instanceName`
  - `instanceType`
  - `externalId` / `externalID`
- Validates order transmission to POS system

**Key Features**:
- Quick check (5-minute timeout)
- Validates order data integrity
- Checks POS sync status
- Uploads API response artifacts

**Post-Test Actions**:
- API response saved as artifact
- Summary report in GitHub Actions
- Fails if any orders missing required fields

---

## Manual-Only Workflows (No Cron Schedule)

These workflows can be triggered manually via `workflow_dispatch` but do not have scheduled runs:

### Production Smoke Tests
- **CA Prod Smoke Test**: `seventen-thelist-ca-prod-smoke-test.yml`
- **FL Prod Smoke Test**: `seventen-thelist-fl-prod-smoke-test.yml`
- **MI Prod Smoke Test**: `seventen-thelist-mi-prod-smoke-test.yml`
- **CO Prod Smoke Test**: `seventen-thelist-co-prod-smoke-test.yml`
- **Purpose**: Quick validation of production after deploys/infrastructure changes

### Production Always-On Tests
- **Live Prod**: `live-prod.yml` - Production live system smoke test
- **Concierge Prod**: `concierge-prod.yml` - Production concierge smoke test
- **Employee Prod**: `employee-prod.yml` - Production employee store smoke test
- **Purpose**: Production system verification (no orders placed)

### Staging Tests
- **Live Stage**: `live-stage.yml` - Staging live tests (cron commented out)
- **Concierge Stage**: `concierge-stage.yml` - Staging concierge tests (cron commented out)
- **FL Stage Functional Tests**: `seventen-thelist-fl-stage-functional-tests.yml`
- **CA Stage Functional Tests**: `seventen-thelist-ca-stage-functional-tests.yml`
- **Purpose**: Pre-production validation

### Build Validation Tests
- Various build validation workflows for different states and environments
- **Purpose**: Validate builds before deployment

### Helper/Utility Workflows
- **Acuity Slot Helper**: `seventen-thelist-dev-acuity-slot-helper.yml` - Creates Acuity scheduling slots (cron commented out)
- **Acuity Slot Automation**: `seventen-thelist-acuity-slot-automation.yml` - Automated slot creation
- **POS Order Generator**: `seventen-thelist-ca-pos-order-generator.yml` - Generates test orders
- **Self-Cancel Workflows**: Order cleanup workflows for CA dev/stage

### Pull Request Validation
- **PR Validation**: `seventen-thelist-pull-request-validation.yml`
- **Purpose**: Validate changes in pull requests

---

## Commented Out / Inactive Schedules

These workflows have cron schedules defined but commented out (not currently active):

### Live Stage
- **Workflow**: `live-stage.yml`
- **Schedule**: `'0 11 * * *'` (commented out)
- **Would Run**: Daily at 11:00 UTC
- **Status**: Disabled - can be manually triggered

### Concierge Stage
- **Workflow**: `concierge-stage.yml`
- **Schedule**: `'0 11 * * *'` (commented out)
- **Would Run**: Daily at 11:00 UTC
- **Status**: Disabled - can be manually triggered

### Acuity Slot Helper
- **Workflow**: `seventen-thelist-dev-acuity-slot-helper.yml`
- **Schedule**: `"0 6 * * 1,3,5"` (commented out)
- **Would Run**: Monday, Wednesday, Friday at 6:00 UTC
- **Purpose**: Would create Acuity scheduling slots automatically
- **Status**: Disabled - can be manually triggered

---

## Cron Schedule Reference

### Time Zone Notes
- **Cron schedules use UTC time**
- **PST/PDT conversions**:
  - 10:00 UTC = 2:00 AM PST / 3:00 AM PDT
  - 11:00 UTC = 3:00 AM PST / 4:00 AM PDT
  - 14:00 UTC = 6:00 AM PST / 7:00 AM PDT

### Cron Syntax
- Format: `'minute hour day month day-of-week'`
- Examples:
  - `'0 11 * * *'` = Every day at 11:00 UTC
  - `'0 14 * * *'` = Every day at 14:00 UTC
  - `"0 6 * * 1,3,5"` = Monday, Wednesday, Friday at 6:00 UTC

---

## Notification & Reporting

### Slack Notifications
All scheduled workflows send notifications to:
- `#tech-savagery-tests`
- `#710labs-qatest-results`

**Notification Content**:
- Test execution status
- Environment information
- Test run ID
- Link to GitHub Actions run
- Failure details (if applicable)

### S3 Report Archiving
- All test reports archived to S3 bucket
- Retention: Configurable per workflow
- Access: Via S3 bucket credentials

### GitHub Actions Artifacts
- Playwright HTML reports
- Screenshots and videos (on failure)
- Order ID files
- API response files (for transmission checks)
- Retention: Typically 3-7 days

### Additional Reporting
- **Tesults Integration**: Some workflows send results to Tesults dashboard
- **GitHub Actions Annotations**: Test results visible in PR checks
- **HTML Reports**: Generated and archived for each run

---

## Workflow Execution Patterns

### Sequential Execution
- **The List Dev Tests**: States run sequentially (CA → FL → MI → CO → NJ)
- **Rationale**: Domain switching required between states
- **Failure Handling**: Continues to next state even if previous fails

### Parallel Execution
- **Always-On Tests**: Can run in parallel (different environments)
- **Rationale**: Independent environments, no shared state
- **Benefits**: Faster overall execution

### Dependent Jobs
- **POS Verification**: Runs after order creation jobs
- **Rationale**: Needs order IDs from test execution
- **Matrix Strategy**: One verification job per order ID

---

## Triggering Manual Runs

### Via GitHub Actions UI
1. Navigate to Actions tab in repository
2. Select desired workflow
3. Click "Run workflow" button
4. Select branch and options (if available)
5. Click "Run workflow"

### Via GitHub API
- Use GitHub Actions API to trigger `workflow_dispatch` events
- Requires appropriate permissions
- Can be integrated into deployment pipelines

### Via npm Scripts
- Some workflows have corresponding npm scripts
- Example: `npm run ci:test:dev:ca`

---

## Best Practices

### When to Use Scheduled Runs
- **Daily Health Checks**: Use scheduled runs for continuous monitoring
- **Regression Detection**: Catch breaking changes early
- **Production Validation**: Schedule smoke tests after known deployment windows

### When to Use Manual Runs
- **After Deployments**: Trigger smoke tests after production deploys
- **Feature Testing**: Test specific features or states
- **Debugging**: Re-run failed tests with additional logging
- **Infrastructure Changes**: Validate after scaling, config changes, etc.

### Monitoring Recommendations
1. **Set up Slack alerts** for critical failures
2. **Review daily reports** for trends
3. **Investigate flaky tests** promptly
4. **Update schedules** as deployment patterns change
5. **Monitor execution times** for performance issues

---

## Troubleshooting

### Workflow Not Running
- Check cron syntax is correct
- Verify workflow file is in `.github/workflows/` directory
- Ensure repository has Actions enabled
- Check for syntax errors in workflow file

### Tests Failing in Scheduled Runs
- Review Slack notifications for details
- Check GitHub Actions logs
- Download artifacts (screenshots, videos, reports)
- Compare with manual runs to identify environment differences

### POS Verification Failures
- Check if orders were actually created
- Verify POS system is accessible
- Review order IDs in artifacts
- Check POS sync timing (may need retry logic)

---

## Related Documentation

- [SUMMARY.MD](SUMMARY.MD) - High-level test suite overview
- [TEST_CASES.MD](TEST_CASES.MD) - Detailed test case breakdown
- [LIVE_COVERAGE.MD](LIVE_COVERAGE.MD) - Always-on test coverage details
- [LIST_COVERAGE.MD](LIST_COVERAGE.MD) - "The list" test coverage details

