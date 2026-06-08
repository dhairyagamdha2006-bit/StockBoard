import {
  parseRows,
  getField,
  findHeader,
  num,
  isJunkSymbol,
  buildHolding,
  CsvParseError,
  type CsvParseResult,
  type CsvRow,
  type NormalizedHolding,
} from "./shared";

const SYMBOL_COLS = ["symbol", "ticker", "sym"];
const NAME_COLS = ["description", "company", "name", "security", "security description", "instrument"];
const SHARES_COLS = ["quantity", "shares", "qty", "share quantity", "quantity (shares)", "shares owned"];
const PRICE_COLS = ["last price", "price", "current price", "market price", "last", "price (usd)", "close price"];
const PER_SHARE_COST_COLS = [
  "average cost",
  "avg cost",
  "average cost basis",
  "cost basis per share",
  "average price",
  "purchase price",
];
const TOTAL_COST_COLS = ["cost basis", "total cost", "cost basis total"];
const VALUE_COLS = ["market value", "current value", "value", "mkt val", "market value (usd)", "position value"];
const TYPE_COLS = ["type", "security type", "asset type", "category"];

/**
 * Flexible parser that accepts common column names from any broker export.
 * Used as a fallback when a broker-specific parser finds nothing.
 */
export function parseGeneric(content: string): CsvParseResult {
  const rows = parseRows(content);
  const warnings: string[] = [];

  if (rows.length === 0) {
    throw new CsvParseError("The file appears to be empty or has no data rows.");
  }

  const headers = Object.keys(rows[0] ?? {});
  if (!findHeader(headers, SYMBOL_COLS)) {
    throw new CsvParseError("Could not find a Symbol/Ticker column.");
  }
  if (!findHeader(headers, SHARES_COLS)) {
    throw new CsvParseError("Could not find a Shares/Quantity column.");
  }

  const hasPerShareCost = !!findHeader(headers, PER_SHARE_COST_COLS);
  const hasTotalCost = !!findHeader(headers, TOTAL_COST_COLS);

  const holdings: NormalizedHolding[] = [];
  let skipped = 0;

  for (const row of rows as CsvRow[]) {
    const symbol = getField(row, SYMBOL_COLS);
    if (isJunkSymbol(symbol)) {
      skipped++;
      continue;
    }

    const shares = num(getField(row, SHARES_COLS));
    const lastPrice = num(getField(row, PRICE_COLS));
    const marketValue = num(getField(row, VALUE_COLS));

    let averageCost = NaN;
    if (hasPerShareCost) {
      averageCost = num(getField(row, PER_SHARE_COST_COLS));
    } else if (hasTotalCost && Number.isFinite(shares) && shares > 0) {
      averageCost = num(getField(row, TOTAL_COST_COLS)) / shares;
    }

    const holding = buildHolding({
      symbol,
      name: getField(row, NAME_COLS),
      shares,
      averageCost,
      lastPrice,
      marketValue,
      assetTypeRaw: getField(row, TYPE_COLS),
    });

    if (holding) holdings.push(holding);
    else skipped++;
  }

  if (holdings.length === 0) {
    throw new CsvParseError("No valid holdings found. Check that the file has Symbol, Quantity, and Price columns.");
  }
  if (skipped > 0) {
    warnings.push(`${skipped} row(s) were skipped (cash, totals, or invalid entries).`);
  }

  return { holdings, warnings, parser: "generic" };
}
