import type { Bar } from "@/lib/prices/market";

/**
 * Portfolio performance history — pure aggregation logic (no I/O, fully testable).
 *
 * Interpretation (honest): this is the value of the user's CURRENT holdings
 * projected back over time using each ticker's historical market price. It is
 * NOT a true historical account balance reconstructed from past buys/sells —
 * we don't have transaction history. The UI states this explicitly.
 *
 *   portfolioValue(date) = Σ over tickers ( shares[ticker] × close[ticker, date] )
 *
 * A forward-fill is applied per ticker so a missing bar on a given day reuses the
 * last known close (markets are closed on weekends/holidays; some tickers have
 * shorter histories). Days before a ticker's first bar contribute nothing for
 * that ticker rather than fabricating a price.
 */

export type PortfolioRange = "1W" | "1M" | "3M" | "1Y";

export const PORTFOLIO_RANGES: PortfolioRange[] = ["1W", "1M", "3M", "1Y"];

export function isPortfolioRange(v: string): v is PortfolioRange {
  return (PORTFOLIO_RANGES as string[]).includes(v);
}

export interface HistoryPoint {
  date: string; // ISO timestamp from the underlying bar
  value: number;
}

export interface PortfolioHistory {
  points: HistoryPoint[];
  source: "current_holdings_market_history" | "empty";
  partial: boolean;
  missingTickers: string[];
}

export interface HoldingShare {
  ticker: string;
  shares: number;
}

/**
 * Collapse holdings (which may include the same ticker across multiple accounts)
 * into a single shares-per-ticker map. Ignores non-positive share counts.
 */
export function aggregateSharesByTicker(holdings: HoldingShare[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const h of holdings) {
    const ticker = (h.ticker ?? "").toUpperCase().trim();
    const shares = Number(h.shares);
    if (!ticker || !Number.isFinite(shares) || shares <= 0) continue;
    map.set(ticker, (map.get(ticker) ?? 0) + shares);
  }
  return map;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Build the portfolio value time series from per-ticker share counts and
 * per-ticker historical bars.
 *
 * @param sharesByTicker shares held per ticker (from aggregateSharesByTicker)
 * @param barsByTicker   historical close bars per ticker (empty array = missing)
 */
export function buildHistoryPoints(
  sharesByTicker: Map<string, number>,
  barsByTicker: Map<string, Bar[]>
): PortfolioHistory {
  const tickers = Array.from(sharesByTicker.keys());

  if (tickers.length === 0) {
    return { points: [], source: "empty", partial: false, missingTickers: [] };
  }

  // Per-ticker date→close map + the union of all bar dates.
  const closeByTickerDate = new Map<string, Map<string, number>>();
  const allDates = new Set<string>();
  const missingTickers: string[] = [];

  for (const ticker of tickers) {
    const bars = barsByTicker.get(ticker) ?? [];
    if (bars.length === 0) {
      missingTickers.push(ticker);
      continue;
    }
    const m = new Map<string, number>();
    for (const b of bars) {
      m.set(b.t, b.c);
      allDates.add(b.t);
    }
    closeByTickerDate.set(ticker, m);
  }

  const sortedDates = Array.from(allDates).sort();

  // If NO ticker returned bars, there's nothing to plot, but it's still a
  // "current holdings" attempt that came back fully partial.
  if (sortedDates.length === 0) {
    return {
      points: [],
      source: "current_holdings_market_history",
      partial: missingTickers.length > 0,
      missingTickers,
    };
  }

  const lastClose = new Map<string, number>(); // ticker → last known close (forward fill)
  const points: HistoryPoint[] = [];

  for (const date of sortedDates) {
    let value = 0;
    let contributed = false;
    for (const ticker of tickers) {
      const m = closeByTickerDate.get(ticker);
      if (!m) continue; // missing ticker — contributes nothing
      const c = m.get(date);
      if (c !== undefined) lastClose.set(ticker, c);
      const price = lastClose.get(ticker);
      if (price !== undefined) {
        value += (sharesByTicker.get(ticker) ?? 0) * price;
        contributed = true;
      }
    }
    if (contributed) points.push({ date, value: round2(value) });
  }

  return {
    points,
    source: "current_holdings_market_history",
    partial: missingTickers.length > 0,
    missingTickers,
  };
}

/**
 * Run an async mapper over items with bounded concurrency so we don't fire one
 * request per holding all at once (protects Alpaca + our rate limits).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length || 1);

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i]);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
