export async function formatNumbers(value: string): Promise<string> {
  return value.replace(/(<([^>]+)>)/gi, '').replace(/\$|,/g, '');
}

export async function bankersRound(num) {
  return (Math.round(num * 100) / 100).toFixed(2);
}

export async function calculateCartTotals(
  taxRates: any,
  productItems: any[],
  usageType
): Promise<any> {
  var taxRate = await new Array();
  if (usageType == 0) {
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
  console.log(taxRate);

  var expectedCartTotal;
  var total = 0;
  var cartSubTotal = 0;
  var grossTaxAmount = 0;
  var exciseTaxAmount = 0;
  var salesTaxAmount = 0;

  for (let i = 0; i < productItems.length; i++) {
    cartSubTotal += Number(productItems[i].subTotal);
    var grossTax = await bankersRound(
      Number(productItems[i].subTotal) * grossRate
    );
    grossTaxAmount += Number(grossTax);
    total = Number(grossTax) + Number(productItems[i].subTotal);

    var exciseTax = await bankersRound(total * exciseRate);
    total = Number(exciseTax) + total;
    exciseTaxAmount += Number(exciseTax);

    var salesTax = await bankersRound(total * salesRate);
    salesTaxAmount += Number(salesTax);
    total = grossTaxAmount + exciseTaxAmount + salesTaxAmount + cartSubTotal;
  }

  var expectedCartSubTotal = await bankersRound(cartSubTotal);
  var expectedGrossTaxAmount = await bankersRound(grossTaxAmount);
  var expectedExciseTaxAmount = await bankersRound(exciseTaxAmount);
  var expectedSalesTaxAmount = await bankersRound(salesTaxAmount);
  var expectedTotal = await bankersRound(total);

  expectedCartTotal = {
    expectedCartSubTotal,
    expectedGrossTaxAmount,
    expectedExciseTaxAmount,
    expectedSalesTaxAmount,
    expectedTotal,
  };
  console.log(expectedCartTotal);

  return expectedCartTotal;
}
