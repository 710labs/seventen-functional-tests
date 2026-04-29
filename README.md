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
QA_ENDPOINT=/wp-json/seventen-qa/v1/ (this will not change from env to env)
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
- menu upload smoke
- focused rules smoke: max quantity and pickup minimum order

Local:

```bash
npm run admin:smoke
MENU_UPLOAD_FIXTURE=smoke-default npm run admin:smoke -- --grep "Menu upload"
npm run admin:smoke -- --grep "@maxqty"
npm run admin:smoke -- --grep "@minorder"
npm run admin:smoke -- --grep "@rules"
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
- `focused_rule_group`: choose `all`, `maxqty`, or `minorder`

Menu upload fixtures:

- committed under `tests/admin-drop-tests/fixtures/menu-upload/`
- selected by `MENU_UPLOAD_FIXTURE`
- default fixture key: `smoke-default`
- workflow dropdown options: `smoke-default`, `smoke-alt`, `ca-menu-4-7-25`, `co-menu-4-7-25`

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
- products include `ADMIN_PHASE3_MAXQTY` and `ADMIN_PHASE3_MINORDER`
- `ADMIN_PHASE3_MAXQTY` uses `Meta: _isa_wc_max_qty_product_max` for the product max quantity rule

Important focused-rules behavior:

- focused-rules smoke is destructive and should only run on Dev or Stage
- before import, it trashes all currently published products
- cleanup scope is published products only
- it does not empty the Trash view
- minimum-order tests edit `/wp-admin/admin.php?page=svntn-core-settings`
- minimum-order tests restore original purchase-limit settings in cleanup
- if the import fails after cleanup, the environment may temporarily have no published products until the next successful import

## Load Testing
Use the manual [Load Tests - The List](https://github.com/710labs/seventen-functional-tests/actions/workflows/artillery-thelist.yml) workflow for browser load tests on AWS Fargate.

Recommended preset for a 100 concurrent CA burst:

- target: `https://thelist-dev.710labs.com`
- env: `dev`
- mode: `ca`
- virtual_users: `100`
- pacing_mode: `rate`
- arrival_rate: `50`
- duration: `2`
- fargate_workers: `5`
- fargate_cpu: `4`
- fargate_memory: `8`
- fargate_capacity: `on_demand`

Notes:

- In `rate` mode, `virtual_users` and `arrival_rate` are cluster totals. With `100` VUs and `50` users/sec across `5` workers, the workflow derives `20` max VUs and `10` users/sec per worker.
- The totals must divide evenly across `fargate_workers` for multi-worker `rate` runs. The workflow will fail fast instead of rounding.
- Use `pacing_mode=rate` for multi-worker runs. Artillery executes `even_spacing` (`arrivalCount`) on only one worker.
- A 2-second burst is enough to overlap all 100 sessions because each CA flow runs much longer than 2 seconds.
- Keep smaller smoke runs in normal CI. Use the burst preset for manual or scheduled performance testing.


## Test Tools
### [Test Tools Documentation](https://documenter.getpostman.com/view/11482169/UVeDuTqj)
Postman collection with examples of endpoints used for grabbing data used in test assertions.

### `GET /rates`
This QA API endpoint returns tax rates by `post_code`. Example: `GET /rates?post_code=90210`. Could also use this [Playwright Script](https://gist.github.com/onlyunusedname/c75e8fa21e4516c687202c26c3cfdd76) to grab info from WordPress directly (more accurate)

### `GET /products`
Returns product info based on one of the following snake_case query params. Only one query param is used per search.

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
