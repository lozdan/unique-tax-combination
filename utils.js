import "process";

export const provincesList = [
  "CABA",
  "BUENOS AIRES",
  "CATAMARCA",
  "CORDOBA",
  "CORRIENTES",
  "CHACO",
  "CHUBUT",
  "ENTRE RIOS",
  "FORMOSA",
  "JUJUY",
  "LA PAMPA",
  "LA RIOJA",
  "MENDOZA",
  "MISIONES",
  "NEUQUEN",
  "RIO NEGRO",
  "SALTA",
  "SAN JUAN",
  "SAN LUIS",
  "SANTA CRUZ",
  "SANTA FE",
  "SANTIAGO DEL ESTERO",
  "TIERRA DEL FUEGO",
  "TUCUMAN",
];

// When applying gross income check first for gravado, if empty go for no-gravado and if empty expempt
export const invoices = (document) => {
  const invoicesSheet = document.find((sheet) => {
    return sheet.name === "LIBRO IVA COMPRAS" || sheet.name === "IVA COMPRAS"
      ? sheet.data
      : undefined;
  });

  if (!invoicesSheet)
    throw new Error(
      "Couldn't find page name. It must be called 'LIBRO IVA COMPRAS'. Fix it, please!"
    );

  return invoicesSheet.data.reduce((acc, data) => {
    const inv = invoiceFields(data);
    const { invoiceNumber, socialReason } = inv;

    const isSocialReasonValid =
      `${socialReason}`.slice(0, 8).toLowerCase() != "gs bcrio";
    const isInvoiceNumberValid =
      typeof invoiceNumber === "string" && invoiceNumber.length === 14;

    // Inform user when invoice is ignored because social reason and avoid it
    if (!isSocialReasonValid) {
      console.log(
        `${invoiceNumber} invoice with taxes ignored according to "Razón social: ${socialReason}".`
      );
    } else if (isInvoiceNumberValid) {
      acc.push(inv);
    }

    return acc;
  }, []);
};

const validateNumber = (num) => typeof num === "number" && num > 0;

const invoiceFields = (inv) => ({
  invoiceNumber: inv[2],
  taxBase: inv[6],
  noTaxBase: inv[7],
  exemptBase: inv[8],
  iva5Tax: inv[18],
  iva10Point5Tax: inv[16],
  iva21Tax: inv[12],
  iva27Tax: inv[14],
  ivaAdditionalTax: inv[19],
  ivaPerceptionTax: inv[21],
  earningsPerceptionTax: inv[20],
  grossIncomePerceptionTax: inv[22],
  socialReason: inv[3],
});

export const grossIncomeTaxByStateObj = (taxesDocument) => {
  const taxesSheet = taxesDocument.find((sheet) => {
    if (sheet.name === "11040536") {
      return sheet.data;
    }
  });

  if (!taxesSheet)
    throw new Error(
      "Couldn't find page name. It must be called '11040536'. Fix it, please!"
    );

  return taxesSheet.data.reduce((acc, data) => {
    const { taxInvoiceNumber, taxTotal, taxCityCode, isTaxInvoiceNumberValid } =
      taxFields(data);

    if (isTaxInvoiceNumberValid) {
      if (acc[taxInvoiceNumber]) {
        acc[taxInvoiceNumber][taxCityCode] = taxTotal;
      } else {
        acc[taxInvoiceNumber] = { [taxCityCode]: taxTotal };
      }
    }
    return acc;
  }, {});
};

const taxFields = (tax) => ({
  taxInvoiceNumber: tax[3],
  taxTotal: tax[4],
  taxCityCode: tax[5],
  isTaxInvoiceNumberValid: typeof tax[3] === "string" && tax[3].length === 14,
});

export const uniqueTaxCombination = (invoices, grossIncomeTaxByState) => {
  const taxCombination = new Set();

  const calculateGrossIncomeTaxByState = (inv) => {
    const {
      grossIncomePerceptionTax,
      taxBase,
      noTaxBase,
      exemptBase,
      invoiceNumber,
    } = inv;
    let finalTaxBase = null;
    // Make sure invoice has gross income taxes
    if (validateNumber(grossIncomePerceptionTax)) {
      switch (true) {
        case validateNumber(taxBase):
          finalTaxBase = taxBase;
          break;
        case validateNumber(noTaxBase):
          finalTaxBase = noTaxBase;
          break;
        case validateNumber(exemptBase):
          finalTaxBase = exemptBase;
          break;
        default:
          break;
      }
    }

    if (!finalTaxBase) return "";
    let taxValue = "";

    for (const tax in grossIncomeTaxByState[invoiceNumber]) {
      const taxNumValue = grossIncomeTaxByState[invoiceNumber][tax];
      const perCentNum = ((taxNumValue / finalTaxBase) * 100).toFixed(4);
      const perCentString = `${provincesList[tax - 1]}: ${perCentNum}`;

      if (perCentNum != 0) {
        if (!taxValue.length) {
          taxValue = perCentString;
        } else {
          taxValue += ` ${perCentString}`;
        }
      }
    }
    return taxValue;
  };

  const noCalculatedIVA = (inv) => {
    const {
      invoiceNumber,
      taxBase,
      iva5Tax,
      iva10Point5Tax,
      iva21Tax,
      iva27Tax,
    } = inv;

    let noCalculatedIvaTaxString = "";

    if (validateNumber(iva5Tax)) noCalculatedIvaTaxString += " IV 5%";
    if (validateNumber(iva10Point5Tax)) noCalculatedIvaTaxString += " IV 10.5%";
    if (validateNumber(iva21Tax)) noCalculatedIvaTaxString += " IV 21%";
    if (validateNumber(iva27Tax)) noCalculatedIvaTaxString += " IV 27%";

    if (noCalculatedIvaTaxString.length && !validateNumber(taxBase)) {
      console.log(
        `ERROR: ${invoiceNumber} has no "Gravado" to apply IVA taxes. Check invoice.`
      );
      process.exit(0);
    }

    return noCalculatedIvaTaxString.trim();
  };

  const calculateOtherTaxes = (inv) => {
    const {
      ivaAdditionalTax,
      ivaPerceptionTax,
      earningsPerceptionTax,
      taxBase,
    } = inv;

    let otherTaxesString = "";
    if (validateNumber(taxBase)) {
      if (validateNumber(ivaAdditionalTax))
        otherTaxesString += ` IV AD ${(
          (ivaAdditionalTax / taxBase) *
          100
        ).toFixed(4)}`;
      if (validateNumber(ivaPerceptionTax))
        otherTaxesString += ` IV PER ${(
          (ivaPerceptionTax / taxBase) *
          100
        ).toFixed(4)}`;
      if (validateNumber(earningsPerceptionTax))
        otherTaxesString += ` GAN ${(
          (earningsPerceptionTax / taxBase) *
          100
        ).toFixed(4)}`;
    }

    return otherTaxesString.trim();
  };

  invoices.forEach((invoice) => {
    let taxCombinationString = noCalculatedIVA(invoice);
    const grossIncomeTaxByStateString = calculateGrossIncomeTaxByState(invoice);
    const otherTaxesString = calculateOtherTaxes(invoice);
    if (otherTaxesString.length) taxCombinationString += ` ${otherTaxesString}`;
    if (grossIncomeTaxByStateString.length)
      taxCombinationString += ` ${grossIncomeTaxByStateString}`;

    taxCombinationString = taxCombinationString.trim();
    if (taxCombinationString.length) {
      taxCombination.add(taxCombinationString);
    }
  });

  return taxCombination;
};
