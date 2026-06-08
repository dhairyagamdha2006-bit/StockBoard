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

let assetsCache: AssetResult[] | null = null;
let assetsExpires = 0;

async function loadAssets(): Promise<AssetResult[]> {
  if (assetsCache && assetsExpires > Date.now()) return assetsCache;
  try {
    const res = await fetch(`${TRADING_BASE}/assets?status=active&asset_class=us_equity`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      logger.warn("Alpaca assets request failed", { provider: "alpaca", status: res.status });
      return assetsCache ?? [];
    }
    const data = (await res.json()) as { symbol: string; name: string; tradable: boolean }[];
    assetsCache = data
      .filter((a) => a.tradable)
      .map((a) => ({ symbol: a.symbol, name: a.name ?? a.symbol }));
    assetsExpires = Date.now() + 60 * 60_000; // 1 hour
    return assetsCache;
  } catch {
    return assetsCache ?? [];
  }
}

export async function searchAssets(query: string, limit = 15): Promise<AssetResult[]> {
  const q = query.trim().toUpperCase();
  if (q.length === 0) return [];
  const assets = await loadAssets();

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
