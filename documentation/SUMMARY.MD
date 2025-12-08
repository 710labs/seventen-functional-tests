# Seventen Functional Tests: Executive Summary

## Purpose
This repository implements automated end-to-end (E2E) tests for all 710 Labs direct-to-consumer web applications, ensuring functional correctness, rapid bug detection, cross-device support, and regulatory compliance across multiple states and user types.

## Test Categories & Coverage
- **Always-On Tests:** Production/live system verification; covers live and concierge portals
- **E2E Tests:** Full order journeys for states (CA, FL, MI, CO, NJ)
- **Smoke Tests:** Rapid validation of core flows for all states and environments
- **Cart Tests:** Discount logic, cart alerts, cart/checkout
- **Gate Tests:** Age gate, list password protection
- **Admin Tests:** Administrative flows (order splitting, admin actions)

## Test Suite Stats
- **20+ spec files** organized by category
- **2,300+ lines** of automated test code
- **30+ CI/CD automation workflows** (multi-env, multi-state)
- **18+ page object classes** for maintainable automation

## Architecture & Tools
- **TypeScript + Playwright** for modern browser automation
- **Page Object Model**: Clean, modular abstraction for pages and flows
- **CI/CD**: GitHub Actions, S3 reports, Slack integrations, automated order validation, artifact management
- **API Test Helpers**: Automated fixture/user generation and validation endpoints
- **Multi-Device Support**: Desktop/Mobile Chrome
- **Config abstraction**: 12+ config files for true multi-environment testing
- **Utility Scripts**: Tax calculations, data generators, slot management, ZIP code/test fixtures

## Workflow Highlights
- Robust config for regional (state) setups, environments (dev, staging, prod, always-on/conciege)
- Tests run in parallel across multiple states and environments, daily and on-demand
- Detailed reporting: Slack, HTML, S3, GitHub Annotations, order ID writing for POS sync and verification
- Visual regression: Baseline image comparison for live homepage and order flows (Playwright snapshots, with masking of dynamic elements)
- Automated API-driven cleanup and fixture creation (planned improvements: test data lifecycle mgmt)

## Strengths
- Modular, scalable architecture following the Page Object Model
- Deep config/env abstraction ensures flexibility and minimal maintenance
- Real-time notifications and transparent reporting
- Automated verification for cannabis-specific business logic (taxation, delivery, POS)
- Flexible and maintainable CI/CD pipeline

## Limitations (see visual_regression_analysis_5bb31c76.plan.md for detail)
- Some visual/functional coverage gaps remain (older flows)
- Test structure mix (legacy class vs new step-based)
- Cleanup and data lifecycle not fully automated
- Several config, fixture, and stability/documentation improvements are in progress

---
For detailed breakdowns and ongoing improvement plans, see:
- [visual_regression_analysis_5bb31c76.plan.md](visual_regression_analysis_5bb31c76.plan.md)
- [TEST_CASES.MD](TEST_CASES.MD)
- [LIVE_COVERAGE.MD](LIVE_COVERAGE.MD)
- [CRON_SCHEDULES.MD](CRON_SCHEDULES.MD)
