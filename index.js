import "process";
import xlsx from "node-xlsx";
import path from "path";
import {
  uniqueTaxCombination,
  invoices,
  grossIncomeTaxByStateObj,
} from "./utils.js";

import { readdir } from "node:fs/promises";

let excelFiles;

try {
  const files = await readdir("./data", { recursive: true });

  excelFiles = files.reduce((acc, elem) => {
    if (
      elem.slice(elem.length - 5, elem.length) === ".xlsx" &&
      elem.includes("CM03")
    )
      acc.push(elem);
    return acc;
  }, []);
} catch (err) {
  console.error(err);
}

console.log("Files to read: ", excelFiles);
if (!excelFiles) throw new Error("Something went wrong getting files path");

let uniqueTaxCombinationSet = new Set();
for (let i = 0; i < excelFiles.length; i++) {
  const __dirname = path.resolve();
  // Read files
  const file = xlsx.parse(`${__dirname}/data/${excelFiles[i]}`);
  console.log("File name:\n", excelFiles[i]);

  // Build invoice and tax data to work with
  const invoicesObj = invoices(file);
  const taxesObj = grossIncomeTaxByStateObj(file);

  // Find all possible tax combination in file
  const allTaxCombinations = uniqueTaxCombination(invoicesObj, taxesObj);
  uniqueTaxCombinationSet = new Set([
    ...uniqueTaxCombinationSet,
    ...allTaxCombinations,
  ]);
}

const sortedTaxesByLength = [...uniqueTaxCombinationSet].sort((a, b) => {
  if (a.length > b.length) return 1;
  if (a.length < b.length) return -1;
  return 0;
});
console.log(
  `FOUND ${sortedTaxesByLength.length} UNIQUE TAX COMBINATION:\n`,
  sortedTaxesByLength
);
