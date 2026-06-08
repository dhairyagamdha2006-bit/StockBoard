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
 * Charles Schwab "Positions" export.
 * Columns: Symbol, Description, Quantity, Price, Market Value, Cost Basis,
 *          Security Type  (plus a preamble line and Cash/Account Total rows).
 */
export function parseSchwab(content: string): CsvParseResult {
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
    const lastPrice = num(getField(row, ["Price"]));
    const marketValue = num(getField(row, ["Market Value", "Mkt Val"]));
    // Schwab reports total cost basis; convert to per-share.
    const totalCost = num(getField(row, ["Cost Basis"]));
    const averageCost = Number.isFinite(totalCost) && shares > 0 ? totalCost / shares : NaN;

    const holding = buildHolding({
      symbol,
      name: getField(row, ["Description"]),
      shares,
      averageCost,
      lastPrice,
      marketValue,
      assetTypeRaw: getField(row, ["Security Type", "Type"]),
    });
    if (holding) holdings.push(holding);
    else skipped++;
  }

  if (holdings.length === 0) {
    throw new CsvParseError("No valid Schwab holdings found in this file.");
  }
  if (skipped > 0) warnings.push(`${skipped} row(s) skipped (cash, totals, or invalid entries).`);
  return { holdings, warnings, parser: "schwab" };
}
