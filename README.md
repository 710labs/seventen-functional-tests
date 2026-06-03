# seventen functional tests

[![seventen-functional-tests](https://github.com/710labs/seventen-functional-tests/actions/workflows/playwright.yml/badge.svg)](https://github.com/710labs/seventen-functional-tests/actions/workflows/playwright.yml)

This repo will house all e2e test scripts for 710 Labs direct-to-consumer web applications . 

## Installation

Clone repo and run the following command below. 

```bash
npm install
```

## Example Test
Here is a very simple test that goes through the age gate user journey. For more complex testing scenarios the Page Object Model is used to centralize page interactions. 
```javascript
    await this.page.goto('/');
    await this.page.click("text=I'm not 21 yet or don't qualify");
    await expect(this.page.locator('.age-gate__error')).toHaveText(
      'You are not old enough to view this content'
    );
```

## Cannabis Tax Calculation
```
Gross Tax = Product Line SubTotal * Gross Tax Rate
Gross Tax Total = Product Line SubTotal + Gross Tax

+ 

State Excise Tax =  Gross Sales Tax Total * State Excise Tax Rate
State Excise Tax Total = Gross Sales Tax Total + State Excise Tax

+ 

Sales Tax = State Excise Tax Total * Sales Tax
State Excise Tax Total = Sales Tax Total + State Excise Tax Total

=

Product Line Total
```
```
Example:
Product Line Subtotal(1) = $150.00
Product Line Subtotal(2) = $72.00
Product Line Subtotal(3) = $90.00
Subtotal = $312.00
ZipCode = 95376 
Type = Recreational
Tax Rates:

"standard/recreational": [
  {
      "rate": 10,
      "label": "County Gross Tax",
      "shipping": "no",
      "compound": "yes"
  },
  {
      "rate": 15,
      "label": "California Excise Tax",
      "shipping": "no",
      "compound": "yes"
  },
  {
      "rate": 8.25,
      "label": "Sales",
      "shipping": "no",
      "compound": "yes"
  }
],
```
```
Example Calculation
Line Item 1:
Gross Tax = Product Line (1) SubTotal($150) * Gross Tax Rate(%10) = $15
Gross Tax Total = Product Line SubTotal($150) + Gross Tax($15) = $165

+ 

State Excise Tax =  Gross Sales Tax Total ($165) * State Excise Tax Rate(%15) = $24.75
State Excise Tax Total = Gross Sales Tax Total($165) + State Excise Tax ($24.75) = $189.75

+ 

Sales Tax = State Excise Tax Total($189.75) * Sales Tax(%8.25) = $15.65
State Excise Tax Total = State Excise Tax Total($189.75) + Sales Tax($15.65) = $205.40

Product Line (1) SubTotal = $150
Product Line (1) Gross Tax = $15
Product Line (1) Excise Tax = $24.75
Product Line (1) Sales Tax = $15.65
Product Line (1) Total = $205.40

Line Item 2:
Gross Tax = Product Line (2) SubTotal($72) * Gross Tax Rate(%10) = $7.20
Gross Tax Total = Product Line SubTotal($72) + Gross Tax($7.20) = $79.20

+ 

State Excise Tax =  Gross Sales Tax Total ($79.20) * State Excise Tax Rate(%15) = $11.88
State Excise Tax Total = Gross Sales Tax Total($79.20) + State Excise Tax ($11.88) = $91.08

+ 

Sales Tax = State Excise Tax Total($91.08) * Sales Tax(%8.25) = $7.51
State Excise Tax Total = State Excise Tax Total($91.08) + Sales Tax($7.51) = $98.59

Product Line (2) SubTotal = $72
Product Line (2) Gross Tax = $7.20
Product Line (2) Excise Tax = $11.88
Product Line (2) Sales Tax = $7.51
Product Line (2) Total = $98.59

Line Item 3:
Gross Tax = Product Line (3) SubTotal($90) * Gross Tax Rate(%10) = $9
Gross Tax Total = Product Line SubTotal($90) + Gross Tax($9) = $99

+ 

State Excise Tax =  Gross Sales Tax Total ($99) * State Excise Tax Rate(%15) = $14.85
State Excise Tax Total = Gross Sales Tax Total($99) + State Excise Tax ($14.85) = $113.85

+ 

Sales Tax = State Excise Tax Total($113.85) * Sales Tax(%8.25) = $9.39
State Excise Tax Total = State Excise Tax Total($113.85) + Sales Tax($9.39) = $123.24

Product Line (3) SubTotal = $90
Product Line (3) Gross Tax = $9
Product Line (3) Excise Tax = $14.85
Product Line (3) Sales Tax = $9.39
Product Line (3) Total = $123.24

Order SubTotal = $312
Order Gross Tax = $31.20
Order Excise Tax = $51.48
Order Sales Tax = $32.55
Order Total = $427.23
```

## Test Execution 
https://user-images.githubusercontent.com/4185025/152637976-501f19f4-76da-4b87-8e9f-aa64b76a2a91.mp4

Local:

This will run the tests in a headed(browser will show on screen) and slightly delayed to allow for easier debugging. These will only run in desktop chrome browser.

Set the following in a .env file before running the tests against a local instance OR pass via command line. 

```
.env file 

BASE_URL (https://local.710labs.com)
API_KEY (slack me for the value) 
ADMIN_USER: Use your login for wp-instance
ADMIN_PW:Use your login for wp-instance
BYPASS_TAX_CALC:This will run tests without verifying tax totals for orders.
ADD_ADDRESS_BEFORE_CHECKOUT= Changes workflow so user adds address information before checking out. 
QA_ENDPOINT=/wp-json/seventen-qa/v1/ (fixed REST namespace; not a secret)
RECAPTCHA_BYPASS: Optional shared secret for the `qa_wf_captcha_bypass` cookie used to bypass Wordfence reCAPTCHA in QA automation.
ACUITY_USER:Used to automate creating acuity schedule slots. 
ACUITY_PASSWORD:Used to automate creating acuity schedule slots. 
```
via Command Line 
```powershell
cross-env BASE_URL=http://localhost:2000 ADMIN_USER=admin@710labs.com ADMIN_PW=supersecure! API_KEY=topsecretkey npm run test:local
```

```powershell
npm run test:local
npm run test:dev
npm run test:staging
npm run test:prod
```

Debug:
```
npm run test:dev -- --debug
```
CI:

These will run in headless mode and will execute in a variety of browsers and viewport sizes in specified environment/domain.


- npm run [ci:test:dev:ca](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-ca-dev-functional-tests.yml)
- npm run [ci:test:staging:ca](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-ca-stage-functional-tests.yml)
- ci:test:prod:ca
- npm run [smoke:test:prod:ca](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-ca-prod-smoke-test.yml)
- npm run [ci:test:dev:fl](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-fl-dev-functional-tests.yml)
- npm run [ci:test:staging:fl](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-fl-stage-functional-tests.yml)
- npm run ci:test:prod:fl
- npm run [smoke:test:prod:fl](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-ca-prod-smoke-test.yml)
- npm run [helper:acuityslots:dev](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-dev-acuity-slot-helper.yml)

## Admin Drop Smoke

The admin-drop smoke suite runs small wp-admin Operations checks from the dedicated admin-drop workflow and Playwright config.

Current coverage includes:

- private-store password smoke
- order export smoke
- admin order split smoke
- menu upload smoke
- focused rules smoke: max quantity
- focused rules smoke: minimum order

Local:

```bash
npm run admin:smoke
npm run admin:smoke:split
MENU_UPLOAD_FIXTURE=smoke-default npm run admin:smoke:menu-upload
npm run admin:smoke:minorder
npm run admin:smoke:maxqty
npm run admin:smoke:all
```

GitHub Actions:

- manual workflow: `.github/workflows/admin-drop-smoke-phase1.yml`
- required inputs: `target_env`
- optional inputs: `grep`, `menu_fixture`, `include_menu_upload`, `include_focused_rules`, `focused_rule_group`
- default workflow runs exclude `Menu upload` and `@rules`
- to run menu upload in GitHub Actions, set:
- `grep`: `Menu upload`
- `include_menu_upload`: `yes`
- `menu_fixture`: choose one dropdown option
- to run focused rules in GitHub Actions, set:
- `include_focused_rules`: `yes`
- `focused_rule_group`: choose `all`, `minorder`, or `maxqty`
- to run minimum order in GitHub Actions, set:
- `include_menu_upload`: `yes`
- `include_focused_rules`: `yes`
- `focused_rule_group`: `minorder`

Minimum-order smoke sequence:

```bash
MENU_UPLOAD_FIXTURE=ca-menu-4-7-25 npm run admin:smoke:menu-upload
npm run admin:smoke:minorder
```

The minimum-order smoke does not import, reset, trash, or restore products. It depends on a
previously uploaded menu, changes the pickup and delivery minimum-order admin settings for the
test, verifies the storefront reaches checkout only after the subtotal exceeds that shared
minimum, places a delivery order, records the order number in Playwright attachments, and restores
the original admin minimums in cleanup.

To run all admin-drop coverage locally, use `npm run admin:smoke:all`. It runs the default
non-destructive smoke first, uploads the full CA menu, then runs `@minorder`, then `@maxqty`.
The command prints each Playwright phase as it runs and finishes with one overall pass/fail
summary for the full ordered flow. Do not use one local unordered Playwright invocation for this
combined path because max quantity resets/imports its own focused fixture and can invalidate the
uploaded-menu precondition.

To override the full-flow menu fixture while keeping the ordered summary runner:

```bash
ADMIN_SMOKE_ALL_MENU_FIXTURE=co-menu-4-7-25 npm run admin:smoke:all
```

Menu upload fixtures:

- committed under `tests/admin-drop-tests/fixtures/menu-upload/`
- selected by `MENU_UPLOAD_FIXTURE`
- default fixture key: `smoke-default`
- workflow dropdown default: `ca-menu-4-7-25`
- workflow dropdown options: `smoke-default`, `smoke-alt`, `ca-menu-4-7-25`, `co-menu-4-7-25`

Use `smoke-default` or `smoke-alt` for importer-only checks. Use `ca-menu-4-7-25` or
`co-menu-4-7-25` before `@minorder` so the storefront has enough realistic products to build
a cart above the randomized minimum.

The menu-upload smoke verifies WooCommerce product import success, then checks the environment-matched `/iframe/` page for every product name from the selected CSV fixture.

Important behavior:

- the menu-upload smoke is destructive
- before import, it trashes all currently published products
- cleanup scope is published products only
- it does not empty the Trash view
- if the import fails after cleanup, the environment may temporarily have no published products until the next successful import

Focused rules fixtures:

- committed under `tests/admin-drop-tests/fixtures/focused-rules/`
- current fixture: `focused-rules-wave1.csv`
- products include `ADMIN_PHASE3_MAXQTY`
- `ADMIN_PHASE3_MAXQTY` uses `Meta: _isa_wc_max_qty_product_max` for the product max quantity rule

Important focused-rules behavior:

- focused-rules smoke is destructive and should only run on Dev or Stage
- max quantity resets/imports its own focused fixture before validation
- minimum order does not import/reset products, but requires a previously uploaded menu
- destructive fixture imports trash currently published products before import
- cleanup scope is published products only
- destructive fixture imports do not empty the Trash view
- if the import fails after cleanup, the environment may temporarily have no published products until the next successful import

## Load Testing
Use the manual [Load Tests - The List](https://github.com/710labs/seventen-functional-tests/actions/workflows/artillery-thelist.yml) workflow for browser load tests on AWS Fargate.

The standard workflow has three inputs:

- env: `dev` or `stage`
- load_pattern: `concurrent_burst` or `total_spread`
- load_size: `1`, `5`, `10`, `25`, `50`, `75`, `100`, `150`, or `200`

`concurrent_burst` starts users quickly to create overlapping browser sessions:

| load_size | maxVusers | arrivalRate | duration | workers | CPU | memory |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 1 | 1 | 4 | 8 |
| 5 | 5 | 5 | 1 | 1 | 4 | 8 |
| 10 | 10 | 10 | 1 | 1 | 4 | 8 |
| 25 | 25 | 25 | 1 | 5 | 4 | 8 |
| 50 | 50 | 25 | 2 | 5 | 4 | 8 |
| 75 | 75 | 25 | 3 | 5 | 4 | 8 |
| 100 | 100 | 50 | 2 | 5 | 4 | 8 |
| 150 | 150 | 50 | 3 | 10 | 4 | 8 |
| 200 | 200 | 100 | 2 | 10 | 4 | 8 |

`total_spread` distributes the selected total users across a longer window:

| load_size | maxVusers | arrivalCount | duration | workers | CPU | memory |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 60 | 1 | 4 | 8 |
| 5 | 5 | 5 | 120 | 1 | 4 | 8 |
| 10 | 10 | 10 | 180 | 1 | 4 | 8 |
| 25 | 25 | 25 | 300 | 1 | 4 | 8 |
| 50 | 50 | 50 | 300 | 1 | 4 | 8 |
| 75 | 75 | 75 | 420 | 1 | 4 | 8 |
| 100 | 100 | 100 | 600 | 1 | 4 | 8 |
| 150 | 150 | 150 | 900 | 1 | 4 | 8 |
| 200 | 200 | 200 | 1200 | 1 | 4 | 8 |

Notes:

- The workflow derives target URL from `env`: dev uses `https://thelist-dev.710labs.com`; stage uses `https://thelist-stage.710labs.com`.
- The standard workflow always runs the CA load flow and adds `6` products per cart.
- Dev/stage Artillery workflows set the QA domain state to CA before Artillery config generation and Fargate execution.
- Multi-worker burst presets derive exact per-worker `maxVusers` and `arrivalRate`; the resolver fails fast if a preset cannot divide evenly.
- Keep smaller smoke runs in normal CI. Use the burst preset for manual or scheduled performance testing.
- Browser load tests pass `RECAPTCHA_BYPASS` through to Fargate and CI fails fast when the GitHub secret is missing.
- Slack notifications include final Artillery JSON report stats for VUsers, top errors, and session length when a report is available.
- Local load runs can still start without `RECAPTCHA_BYPASS`, but the scripts will warn and skip the recaptcha bypass cookie. Preferred local usage: `RECAPTCHA_BYPASS=<secret> ARTILLERY_LIST_PASSWORD=<password> npm run load:ca:dev`.


## Test Tools
### [Test Tools Documentation](https://documenter.getpostman.com/view/11482169/UVeDuTqj)
Postman collection with examples of endpoints used for grabbing data used in test assertions.

The QA API base is `/wp-json/seventen-qa/v1/`. Successful responses use the
`{ outcome: "success", data: { ... } }` envelope. The `QA_ENDPOINT` value is not
sensitive; `API_KEY` remains the secret and is sent through the `x-api-key` header.

### `GET /rates`
This QA API endpoint returns tax rates by `post_code`. Example: `GET /rates?post_code=90210`. Could also use this [Playwright Script](https://gist.github.com/onlyunusedname/c75e8fa21e4516c687202c26c3cfdd76) to grab info from WordPress directly (more accurate)

### `GET /products`
Returns product info based on one of the following query params. Only one query param is used per search.

- product_id
- product_sku
- product_name

### `POST /users`
This QA API endpoint creates test users for automation with form fields `user_role`, `user_vintage`, and `user_usage`. Users created via this endpoint are still cleaned up every 48 hours automatically.

### `POST /domains`
This QA API endpoint switches the QA domain state in dev and stage. Send the desired `state` as form data.

### [POST Acuity Webhooks](https://documenter.getpostman.com/view/11482169/UVeDuTqj#d066d956-ab34-4134-9ad4-35338c018539)
This endpoint will automate the process of enabling/disabling acuity webhooks in all environments + stg. 

### Test Tool Security 
Endpoints will require a `x-api-key` header. You can set this apiKey [here](https://thelist-dev.710labs.com/wp-admin/tools.php?page=svntn-qa).


## Test Run Schedule
- [ci:test:dev:ca](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-ca-dev-functional-tests.yml):Daily 7AM PST
- [ci:test:dev:fl](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-fl-dev-functional-tests.yml):Daily 8AM PST
- [smoke:test:prod:ca](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-ca-prod-smoke-test.yml):On demand via gh-actions
- [smoke:test:prod:fl](https://github.com/710labs/seventen-functional-tests/actions/workflows/seventen-thelist-ca-prod-smoke-test.yml): On Demand via gh-actions

### Triggering Smoke Tests 
Use the following GH Actions API requests to view workflows and create dispatch events that will kick off the smoke tests. This will mainly verify the state of production after various infra events such as deploys, builds, scaling, etc. Use the postman collection below to review the github actions api requests.


[710Labs Github Actions API Triggers](https://documenter.getpostman.com/view/11482169/UVeDuTqj#c3365b2e-43d5-4c4f-adc6-5fd463c523e6)
