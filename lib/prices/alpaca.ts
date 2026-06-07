import type { AlpacaSnapshot } from "@/types";
import { getAlpacaCreds } from "@/lib/env";

/**
 * Alpaca market-data client (REST snapshots).
 *
 * Note: the dashboard refreshes prices by polling this endpoint every ~30s and
 * via Supabase Realtime pushes on the price_cache table. There is intentionally
 * NO browser WebSocket to Alpaca — that would require exposing API keys to the
 * client, which we don't do.
 */
const ALPACA_DATA_BASE = "https://data.alpaca.markets/v2";

function authHeaders(): Record<string, string> {
  const { keyId, secretKey } = getAlpacaCreds();
  return { "APCA-API-KEY-ID": keyId, "APCA-API-SECRET-KEY": secretKey };
}

export async function getSnapshots(tickers: string[]): Promise<Map<string, AlpacaSnapshot>> {
  if (tickers.length === 0) return new Map();

  const params = new URLSearchParams({ symbols: tickers.join(",") });
  const res = await fetch(`${ALPACA_DATA_BASE}/stocks/snapshots?${params}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    // Log status only — never the response body (avoids leaking any echoed creds).
    console.error(`Alpaca snapshots request failed with status ${res.status}`);
    return new Map();
  }

  const data: Record<string, AlpacaSnapshot> = await res.json();
  return new Map(Object.entries(data));
}

export interface PriceQuote {
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
}

export async function getLatestBars(tickers: string[]): Promise<Map<string, PriceQuote>> {
  const snapshots = await getSnapshots(tickers);
  const result = new Map<string, PriceQuote>();

  for (const [symbol, snap] of Array.from(snapshots)) {
    const price = snap.latestTrade?.p ?? snap.minuteBar?.c ?? 0;
    const prevClose = snap.prevDailyBar?.c ?? 0;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    result.set(symbol, { price, prevClose, change, changePct });
  }

  return result;
}
