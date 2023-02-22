import bankersRounding from 'bankers-rounding';

export async function formatNumbers(value: string): Promise<string> {
  return value.replace(/(<([^>]+)>)/gi, '').replace(/\$|,/g, '').replace(/\-|,/g, '');
}

export async function calculateCartTotals(
  taxRates: any,
  productItems: any[],
  usageType: number
): Promise<any> {
  var taxRate = await new Array();
  if (usageType === 0) {
    taxRate = await taxRates.rates.standard;
    var grossRate =
      taxRate.find((tax) => {
        return tax.label === 'County Gross Tax';
      }).rate / 100;
    var exciseRate =
      taxRate.find((tax) => {
        return tax.label === 'California Excise Tax';
      }).rate / 100;
    var salesRate =
      taxRate.find((tax) => {
        return tax.label === 'Sales';
      }).rate / 100;
  } else {
    taxRate = await taxRates.rates['medical-rate'];
    var grossRate =
      taxRate.find((tax) => {
        return tax.label === 'Gross';
      }).rate / 100;
    var exciseRate =
      taxRate.find((tax) => {
        return tax.label === 'Excise';
      }).rate / 100;
    var salesRate =
      taxRate.find((tax) => {
        return tax.label === 'Sales';
      }).rate / 100;
  }

  var expectedCartTotal;
  var total = 0;
  var cartSubTotal = 0;
  var grossTaxAmount = 0;
  var exciseTaxAmount = 0;
  var salesTaxAmount = 0;

  for (let i = 0; i < productItems.length; i++) {
    cartSubTotal += Number(productItems[i].subTotal);
    var grossTax = await bankersRounding(
      Number(productItems[i].subTotal) * grossRate,
      3
    );
    grossTaxAmount += grossTax;
    total = grossTax + Number(productItems[i].subTotal);

    var exciseTax = await bankersRounding(total * exciseRate, 3);
    total = exciseTax + total;
    exciseTaxAmount += Number(exciseTax);

    var salesTax = await bankersRounding(total * salesRate, 3);
    salesTaxAmount += salesTax;
    total = grossTaxAmount + exciseTaxAmount + salesTaxAmount + cartSubTotal;
  }

  var expectedCartSubTotal = cartSubTotal.toString();
  var expectedGrossTaxAmount = grossTaxAmount.toString();
  var expectedExciseTaxAmount = exciseTaxAmount.toString();
  var expectedSalesTaxAmount = salesTaxAmount.toString();
  var expectedTotal = bankersRounding(total, 2).toString();

  expectedCartTotal = {
    expectedCartSubTotal,
    expectedGrossTaxAmount,
    expectedExciseTaxAmount,
    expectedSalesTaxAmount,
    expectedTotal,
  };
  return expectedCartTotal;
}
