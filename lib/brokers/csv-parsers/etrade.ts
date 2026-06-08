import {
  parseRows,
  stripPreamble,
  getField,
  num,
  isJunkSymbol,
  buildHolding,
  CsvParseError,
  type CsvParseResult,
  type NormalizedHolding,
} from "./shared";

/**
 * E*TRADE portfolio export.
 * Columns: Symbol, Last Price $, Quantity, Price Paid $, Value $
 *          (Price Paid is per-share cost; plus a TOTAL row).
 */
export function parseEtrade(content: string): CsvParseResult {
  const rows = parseRows(stripPreamble(content, "symbol"));
  const warnings: string[] = [];
  const holdings: NormalizedHolding[] = [];
  let skipped = 0;

  for (const row of rows) {
    const symbol = getField(row, ["Symbol"]);
    if (isJunkSymbol(symbol)) {
      skipped++;
      continue;
    }

    const shares = num(getField(row, ["Quantity", "Qty"]));
    const lastPrice = num(getField(row, ["Last Price $", "Last Price", "Price"]));
    const marketValue = num(getField(row, ["Value $", "Market Value", "Value"]));
    const averageCost = num(getField(row, ["Price Paid $", "Price Paid", "Purchase Price", "Average Cost"]));

    const holding = buildHolding({
      symbol,
      name: getField(row, ["Description", "Company"]),
      shares,
      averageCost,
      lastPrice,
      marketValue,
      assetTypeRaw: getField(row, ["Type"]),
    });
    if (holding) holdings.push(holding);
    else skipped++;
  }

  if (holdings.length === 0) {
    throw new CsvParseError("No valid E*TRADE holdings found in this file.");
  }
  if (skipped > 0) warnings.push(`${skipped} row(s) skipped (cash, totals, or invalid entries).`);
  return { holdings, warnings, parser: "etrade" };
}
