# seventen functional tests

[![seventen-functional-tests](https://github.com/710labs/seventen-functional-tests/actions/workflows/playwright.yml/badge.svg)](https://github.com/710labs/seventen-functional-tests/actions/workflows/playwright.yml)

This repo will house all e2e test scripts for 710 Labs direct-to-consumer web applications. 

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
    await expect(this.page.locator('.age-gate-error-message')).toHaveText(
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
QA_ENDPOINT=/wp-content/plugins/seventen-qa/api/ (this will not change from env to env)
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


## Test Tools
### [Test Tools Documentation](https://documenter.getpostman.com/view/11482169/UVeDuTqj)
Postman collection with examples of endpoints used for grabbing data used in test assertions.

### [GET Tax Rates By Zip](https://documenter.getpostman.com/view/11482169/UVeDuTqj#1db7646b-22e5-43f8-ad03-8f268a708b39)
This API endpoint will return all tax rates (standard/medical, gross, excise, and sales) by zipcode query param. Could also use this [Playwright Script](https://gist.github.com/onlyunusedname/c75e8fa21e4516c687202c26c3cfdd76) to grab info from WordPress directly (more accurate)

### [GET Product Info](https://documenter.getpostman.com/view/11482169/UVeDuTqj#69c89906-d358-4f42-87a9-9476bcbf2905)
Returns product info based on the following query params. These params are used in the following hierarchy if all are supplied. Only one query param is used per search.

- productId
- productSku
- productName

### [POST Customer](https://documenter.getpostman.com/view/11482169/UVeDuTqj#e201c50d-f5bd-4d9b-800a-27ddf8b869a5)
This endpoint will automate the process of creating new and legacy users that can be used in tests. Users created via this endpoint will be cleaned up every 48 hours automatically. 

### [POST Domain](https://documenter.getpostman.com/view/11482169/UVeDuTqj#d066d956-ab34-4134-9ad4-35338c018539)
This endpoint will automate the process of switching from CA to FL settings in dev + stg. 

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

