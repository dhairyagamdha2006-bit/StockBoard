import "server-only";
import { getAlpacaCreds } from "@/lib/env";
import { getSnapshots } from "./alpaca";
import { logger } from "@/lib/utils/logger";

/**
 * Server-side market-data helpers (quotes, historical bars, symbol search).
 * Alpaca keys never leave the server. Light in-memory caching reduces API usage.
 */

const DATA_BASE = "https://data.alpaca.markets/v2";
const TRADING_BASE = "https://api.alpaca.markets/v2";

function authHeaders(): Record<string, string> {
  const { keyId, secretKey } = getAlpacaCreds();
  return { "APCA-API-KEY-ID": keyId, "APCA-API-SECRET-KEY": secretKey };
}

// --- tiny TTL cache --------------------------------------------------------
interface CacheEntry<T> {
  value: T;
  expires: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e || e.expires < Date.now()) {
    if (e) cache.delete(key);
    return null;
  }
  return e.value as T;
}
function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

// --- quote -----------------------------------------------------------------
export interface MarketQuote {
  symbol: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getQuote(symbol: string): Promise<MarketQuote | null> {
  const key = `quote:${symbol}`;
  const cached = cacheGet<MarketQuote>(key);
  if (cached) return cached;

  const snaps = await getSnapshots([symbol]);
  const snap = snaps.get(symbol);
  if (!snap) return null;

  const price = snap.latestTrade?.p ?? snap.dailyBar?.c ?? 0;
  const prevClose = snap.prevDailyBar?.c ?? 0;
  const daily = snap.dailyBar ?? { o: 0, h: 0, l: 0, c: 0, v: 0, t: "" };
  const quote: MarketQuote = {
    symbol,
    price,
    prevClose,
    change: price - prevClose,
    changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
    open: daily.o,
    high: daily.h,
    low: daily.l,
    close: daily.c,
    volume: daily.v,
  };
  cacheSet(key, quote, 15_000);
  return quote;
}

// --- bars ------------------------------------------------------------------
export type BarRange = "1D" | "1W" | "1M" | "3M" | "1Y";
export interface Bar {
  t: string;
  c: number;
}

const RANGE_CONFIG: Record<BarRange, { timeframe: string; lookbackMs: number }> = {
  "1D": { timeframe: "15Min", lookbackMs: 1 * 24 * 60 * 60 * 1000 },
  "1W": { timeframe: "1Hour", lookbackMs: 7 * 24 * 60 * 60 * 1000 },
  "1M": { timeframe: "1Day", lookbackMs: 31 * 24 * 60 * 60 * 1000 },
  "3M": { timeframe: "1Day", lookbackMs: 93 * 24 * 60 * 60 * 1000 },
  "1Y": { timeframe: "1Day", lookbackMs: 366 * 24 * 60 * 60 * 1000 },
};

export function isBarRange(v: string): v is BarRange {
  return ["1D", "1W", "1M", "3M", "1Y"].includes(v);
}

export async function getBars(symbol: string, range: BarRange): Promise<Bar[]> {
  const key = `bars:${symbol}:${range}`;
  const cached = cacheGet<Bar[]>(key);
  if (cached) return cached;

  const cfg = RANGE_CONFIG[range];
  const start = new Date(Date.now() - cfg.lookbackMs).toISOString();
  const params = new URLSearchParams({
    timeframe: cfg.timeframe,
    start,
    limit: "1000",
    adjustment: "raw",
    feed: "iex",
  });

  try {
    const res = await fetch(`${DATA_BASE}/stocks/${encodeURIComponent(symbol)}/bars?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      logger.warn("Alpaca bars request failed", { provider: "alpaca", status: res.status, range });
      return [];
    }
    const data = await res.json();
    const bars: Bar[] = (data.bars ?? []).map((b: { t: string; c: number }) => ({ t: b.t, c: b.c }));
    cacheSet(key, bars, range === "1D" ? 30_000 : 5 * 60_000);
    return bars;
  } catch {
    logger.warn("Alpaca bars request errored", { provider: "alpaca", range });
    return [];
  }
}

// --- symbol search ---------------------------------------------------------
export interface AssetResult {
  symbol: string;
  name: string;
}

export type SearchSource = "alpaca" | "fallback";

export interface SearchResponse {
  results: AssetResult[];
  source: SearchSource;
  warning?: string;
}

/**
 * Static fallback list of popular US stocks/ETFs. Used when Alpaca's asset list
 * is unavailable (missing credentials, slow, errored) so search never hangs and
 * always returns usable results. These are well-known symbols, not fabricated.
 */
export const FALLBACK_ASSETS: AssetResult[] = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corp." },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "GOOG", name: "Alphabet Inc." },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "NFLX", name: "Netflix Inc." },
  { symbol: "AMD", name: "Advanced Micro Devices Inc." },
  { symbol: "INTC", name: "Intel Corp." },
  { symbol: "JPM", name: "JPMorgan Chase & Co." },
  { symbol: "BAC", name: "Bank of America Corp." },
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "COST", name: "Costco Wholesale Corp." },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "MA", name: "Mastercard Inc." },
  { symbol: "DIS", name: "Walt Disney Co." },
  { symbol: "SPY", name: "SPDR S&P 500 ETF" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
  { symbol: "QQQ", name: "Invesco QQQ ETF" },
];

/** Symbols shown in the "Popular stocks" section when the search box is empty. */
const POPULAR_SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "SPY", "VOO"];

/** The curated popular-stock list (always available, no Alpaca dependency). */
export function getPopularAssets(): AssetResult[] {
  return POPULAR_SYMBOLS.map(
    (s) => FALLBACK_ASSETS.find((a) => a.symbol === s) ?? { symbol: s, name: s }
  );
}

export const ALPACA_UNAVAILABLE_WARNING =
  "Live market search is unavailable because Alpaca is not configured. Showing popular fallback symbols.";

const ASSETS_TIMEOUT_MS = 5000;

let assetsCache: AssetResult[] | null = null;
let assetsExpires = 0;

/**
 * Load Alpaca's tradable asset list. Returns `null` (not an empty array) when
 * Alpaca is unavailable so callers can distinguish "no matches" from "couldn't
 * reach Alpaca" and fall back accordingly. Hard 5s timeout — never hangs.
 */
async function loadAlpacaAssets(): Promise<AssetResult[] | null> {
  if (assetsCache && assetsExpires > Date.now()) return assetsCache;

  let headers: Record<string, string>;
  try {
    headers = authHeaders(); // throws if Alpaca creds are missing/placeholder
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSETS_TIMEOUT_MS);
  try {
    const res = await fetch(`${TRADING_BASE}/assets?status=active&asset_class=us_equity`, {
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn("Alpaca assets request failed", { provider: "alpaca", status: res.status });
      return assetsCache; // may be null
    }
    const data = (await res.json()) as { symbol: string; name: string; tradable: boolean }[];
    assetsCache = data
      .filter((a) => a.tradable)
      .map((a) => ({ symbol: a.symbol, name: a.name ?? a.symbol }));
    assetsExpires = Date.now() + 60 * 60_000; // 1 hour
    return assetsCache;
  } catch {
    logger.warn("Alpaca assets request errored or timed out", { provider: "alpaca" });
    return assetsCache; // may be null
  } finally {
    clearTimeout(timer);
  }
}

/** Rank matches: exact symbol, symbol prefix, then symbol/name substring. */
function matchAssets(assets: AssetResult[], q: string, limit: number): AssetResult[] {
  const starts: AssetResult[] = [];
  const contains: AssetResult[] = [];
  for (const a of assets) {
    if (a.symbol === q) starts.unshift(a);
    else if (a.symbol.startsWith(q)) starts.push(a);
    else if (a.symbol.includes(q) || a.name.toUpperCase().includes(q)) contains.push(a);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * Search assets. Uses Alpaca's full asset list when available; falls back to the
 * curated popular list when Alpaca is missing/slow/errored. Always returns
 * promptly with a `source` flag and an optional `warning`.
 */
export async function searchAssets(query: string, limit = 15): Promise<SearchResponse> {
  const q = query.trim().toUpperCase();
  if (q.length === 0) return { results: [], source: "alpaca" };

  const alpaca = await loadAlpacaAssets();

  if (alpaca && alpaca.length > 0) {
    const results = matchAssets(alpaca, q, limit);
    if (results.length > 0) return { results, source: "alpaca" };
    // Alpaca is reachable but returned no match — still surface fallback hits
    // (e.g. common names) without a warning, since live search is working.
    const fb = matchAssets(FALLBACK_ASSETS, q, limit);
    return { results: fb, source: fb.length > 0 ? "fallback" : "alpaca" };
  }

  // Alpaca unavailable → fallback list with an honest warning.
  const results = matchAssets(FALLBACK_ASSETS, q, limit);
  return { results, source: "fallback", warning: ALPACA_UNAVAILABLE_WARNING };
}
