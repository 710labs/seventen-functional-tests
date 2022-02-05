# SevenTen Functional Tests

This repo will house all e2e test scripts for 710 Labs direct-to-consumer web applications. 

## Installation

Clone repo and run the following command below. 

```bash
npm install
```

## Example Test
Here is a very simple test that goes throug hthe age gate user journey. For more complex testing scenarios the Page Object Model is used to centralize page interactions. 
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

Local:

This will run the tests in a headed(browser will show on screen) and slightly delayed to allow for easier debugging. These will only run in desktop chrome browser.
```powershell
npm run test:dev
npm run test:staging
npm run test:prod
```
CI:

These will run in headless mode and will execute in a variety of browsers and viewport sizes

```powershell
npm run ci:test:dev
npm run ci:test:staging
npm run ci:test:prod

```

## Contributing
