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
 * Fidelity "Portfolio Positions" export.
 * Columns: Symbol, Description, Quantity, Last Price, Current Value,
 *          Average Cost Basis, Cost Basis Total, Type
 */
export function parseFidelity(content: string): CsvParseResult {
  const rows = parseRows(content);
  const warnings: string[] = [];
  const holdings: NormalizedHolding[] = [];
  let skipped = 0;

  for (const row of rows) {
    const symbol = getField(row, ["Symbol"]);
    if (isJunkSymbol(symbol)) {
      skipped++;
      continue;
    }

    const shares = num(getField(row, ["Quantity"]));
    const lastPrice = num(getField(row, ["Last Price"]));
    const marketValue = num(getField(row, ["Current Value"]));
    let averageCost = num(getField(row, ["Average Cost Basis"]));
    if (!Number.isFinite(averageCost)) {
      const totalCost = num(getField(row, ["Cost Basis Total", "Cost Basis"]));
      if (Number.isFinite(totalCost) && shares > 0) averageCost = totalCost / shares;
    }

    const holding = buildHolding({
      symbol,
      name: getField(row, ["Description"]),
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
    throw new CsvParseError("No valid Fidelity holdings found in this file.");
  }
  if (skipped > 0) warnings.push(`${skipped} row(s) skipped (cash, totals, or invalid entries).`);
  return { holdings, warnings, parser: "fidelity" };
}
