import Papa from "papaparse";
import type { NormalizedHolding } from "@/lib/brokers/robinhood";

export type { NormalizedHolding };

export interface CsvParseResult {
  holdings: NormalizedHolding[];
  warnings: string[];
  /** Which parser produced the result ("fidelity", "generic", …). */
  parser: string;
}

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

export type CsvRow = Record<string, string | undefined>;

/**
 * Some broker exports (Schwab, E*TRADE) prepend preamble lines ("Positions for
 * account … as of …") before the real header. Drop everything before the first
 * line that looks like the column header (contains a comma and the hint word).
 */
export function stripPreamble(content: string, hint = "symbol"): string {
  const lines = content.split(/\r?\n/);
  const idx = lines.findIndex(
    (l) => l.includes(",") && l.toLowerCase().includes(hint.toLowerCase())
  );
  if (idx <= 0) return content;
  return lines.slice(idx).join("\n");
}

/** Parse CSV text into trimmed, header-keyed rows. */
export function parseRows(content: string): CsvRow[] {
  const { data } = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  return data;
}

/** Case-insensitive field lookup against a row, trying several column names. */
export function getField(row: CsvRow, candidates: string[]): string | undefined {
  const lowerToKey = new Map<string, string>();
  for (const key of Object.keys(row)) lowerToKey.set(key.toLowerCase().trim(), key);
  for (const c of candidates) {
    const key = lowerToKey.get(c.toLowerCase());
    if (key !== undefined) {
      const val = row[key];
      if (val !== undefined && val !== "") return val;
    }
  }
  return undefined;
}

/** Returns the original header that matches any candidate (or undefined). */
export function findHeader(headers: string[], candidates: string[]): string | undefined {
  const set = new Set(candidates.map((c) => c.toLowerCase()));
  return headers.find((h) => set.has(h.toLowerCase().trim()));
}

/** Parse a money/number string: strips $ , % spaces; supports (x) negatives. */
export function num(raw: string | undefined): number {
  if (raw == null) return NaN;
  let s = raw.trim();
  if (s === "" || s === "--" || s === "N/A" || s === "n/a") return NaN;
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[()$,%\s]/g, "");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  return negative ? -n : n;
}

const VALID_TICKER = /^[A-Z0-9.\-]{1,12}$/;

/** Normalize + validate a ticker symbol, or return null if it's junk. */
export function cleanTicker(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toUpperCase();
  if (!VALID_TICKER.test(t)) return null;
  return t;
}

const JUNK_SYMBOL_HINTS = [
  "total",
  "cash",
  "pending",
  "account",
  "**",
  "money market",
  "sweep",
  "spaxx", // Fidelity core cash often shows; keep? It's a real fund, but treat conservatively
];

/** True if this row is clearly a totals/cash/section row, not a holding. */
export function isJunkSymbol(symbol: string | undefined): boolean {
  if (!symbol) return true;
  const s = symbol.toLowerCase();
  return JUNK_SYMBOL_HINTS.some((h) => s.includes(h));
}

/** Infer asset type from an optional type column + the symbol shape. */
export function inferAssetType(typeRaw: string | undefined, symbol: string): NormalizedHolding["asset_type"] {
  const t = (typeRaw ?? "").toLowerCase();
  if (t.includes("etf")) return "etf";
  if (t.includes("option")) return "option";
  if (t.includes("crypto")) return "crypto";
  // Options symbols are long; treat very long symbols as options.
  if (symbol.length > 6) return "option";
  return "stock";
}

/**
 * Build a NormalizedHolding from already-extracted fields. Returns null if the
 * row lacks the essentials (valid ticker + positive share count).
 *
 * `previous_close` defaults to `current_price` (zero intraday change) because a
 * positions CSV rarely contains a prior close — the live price refresh fills in
 * the real day change later. We never fabricate movement.
 */
export function buildHolding(input: {
  symbol: string | undefined;
  name?: string;
  shares: number;
  averageCost: number;
  lastPrice: number;
  marketValue: number;
  assetTypeRaw?: string;
}): NormalizedHolding | null {
  const ticker = cleanTicker(input.symbol);
  if (!ticker) return null;
  if (!Number.isFinite(input.shares) || input.shares <= 0) return null;

  let currentPrice = input.lastPrice;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    currentPrice = input.shares > 0 && Number.isFinite(input.marketValue) ? input.marketValue / input.shares : 0;
  }

  let averageCost = input.averageCost;
  if (!Number.isFinite(averageCost) || averageCost < 0) averageCost = currentPrice;

  return {
    ticker,
    company_name: input.name?.trim() || ticker,
    shares: input.shares,
    average_cost: averageCost,
    current_price: currentPrice,
    previous_close: currentPrice,
    asset_type: inferAssetType(input.assetTypeRaw, ticker),
  };
}
