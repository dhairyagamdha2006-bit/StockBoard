import {
  parseRows,
  getField,
  num,
  isJunkSymbol,
  buildHolding,
  CsvParseError,
  type CsvParseResult,
  type NormalizedHolding,
} from "./shared";

/**
 * Robinhood CSV.
 *
 * Robinhood does not provide an official positions CSV, so we accept a simple,
 * documented template using common column names:
 *   Symbol/Ticker, Name/Description, Shares/Quantity,
 *   Average Cost/Average Buy Price, Price/Last Price, Market Value
 * (This keeps Robinhood usable via CSV without relying on the unofficial API.)
 */
export function parseRobinhood(content: string): CsvParseResult {
  const rows = parseRows(content);
  const warnings: string[] = [];
  const holdings: NormalizedHolding[] = [];
  let skipped = 0;

  for (const row of rows) {
    const symbol = getField(row, ["Symbol", "Ticker", "Instrument"]);
    if (isJunkSymbol(symbol)) {
      skipped++;
      continue;
    }

    const shares = num(getField(row, ["Shares", "Quantity", "Qty"]));
    const lastPrice = num(getField(row, ["Price", "Last Price", "Current Price"]));
    const marketValue = num(getField(row, ["Market Value", "Value", "Equity"]));
    const averageCost = num(getField(row, ["Average Cost", "Average Buy Price", "Avg Cost", "Cost"]));

    const holding = buildHolding({
      symbol,
      name: getField(row, ["Name", "Description", "Company"]),
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
    throw new CsvParseError(
      "No valid holdings found. Use columns: Symbol, Shares, Average Cost, Price."
    );
  }
  if (skipped > 0) warnings.push(`${skipped} row(s) skipped (cash, totals, or invalid entries).`);
  return { holdings, warnings, parser: "robinhood" };
}
