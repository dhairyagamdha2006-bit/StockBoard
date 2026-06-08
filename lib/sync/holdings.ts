import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedHolding } from "@/lib/brokers/robinhood";

export interface ComputedHoldingRow {
  user_id: string;
  account_id: string;
  ticker: string;
  company_name: string;
  shares: number;
  average_cost: number;
  current_price: number;
  market_value: number;
  day_change: number;
  day_change_pct: number;
  total_gain_loss: number;
  total_gain_loss_pct: number;
  asset_type: string;
  updated_at: string;
}

/**
 * Merge duplicate tickers in a raw holdings array before any DB write.
 *
 * Postgres raises "ON CONFLICT DO UPDATE command cannot affect row a second
 * time" when the same (account_id, ticker) appears more than once in a single
 * upsert batch. This function guarantees exactly one element per uppercase
 * ticker, so the batch is always safe.
 *
 * Merge rules:
 *  - Shares are summed.
 *  - average_cost is the share-weighted mean: Σ(shares × cost) / Σshares.
 *  - current_price / previous_close: largest non-zero value wins.
 *  - company_name: longest non-empty string wins (falls back to ticker).
 *  - asset_type: first non-empty value wins.
 *  - Rows with shares ≤ 0, NaN, or dust (shares < 1e-8 and no price signal)
 *    are silently dropped before grouping.
 */
export function deduplicateHoldings(holdings: NormalizedHolding[]): {
  deduplicated: NormalizedHolding[];
  mergeWarnings: string[];
} {
  const VALID_TICKER = /^[A-Z0-9.\-]{1,12}$/;
  const groups = new Map<string, NormalizedHolding[]>();

  for (const h of holdings) {
    const ticker = (h.ticker ?? "").toUpperCase().trim();
    if (!ticker || !VALID_TICKER.test(ticker)) continue;
    if (!Number.isFinite(h.shares) || h.shares <= 0) continue;
    // Drop dust rows: negligible shares with no price signal whatsoever
    if (h.shares < 1e-8 && h.current_price <= 0 && h.average_cost <= 0) continue;

    const bucket = groups.get(ticker);
    if (bucket) {
      bucket.push({ ...h, ticker });
    } else {
      groups.set(ticker, [{ ...h, ticker }]);
    }
  }

  const deduplicated: NormalizedHolding[] = [];
  const mergeWarnings: string[] = [];

  for (const [ticker, rows] of groups) {
    if (rows.length === 1) {
      deduplicated.push(rows[0]);
      continue;
    }

    // Multiple rows for the same ticker — merge.
    mergeWarnings.push(`${rows.length} ${ticker} rows were merged into one holding.`);

    const totalShares = rows.reduce((s, r) => s + r.shares, 0);
    const totalCost = rows.reduce((s, r) => s + r.shares * r.average_cost, 0);
    const weightedAvgCost = totalShares > 0 ? totalCost / totalShares : 0;

    // Largest non-zero price wins
    const bestPrice = rows.reduce(
      (best, r) => (r.current_price > 0 ? Math.max(best, r.current_price) : best),
      0
    );
    const bestPrevClose = rows.reduce(
      (best, r) => (r.previous_close > 0 ? Math.max(best, r.previous_close) : best),
      0
    );

    // Longest non-empty company name
    const bestName = rows.reduce((best, r) => {
      const n = (r.company_name ?? "").trim();
      return n.length > best.length ? n : best;
    }, ticker);

    // First non-empty asset_type
    const assetType = rows.find((r) => r.asset_type && r.asset_type !== "")?.asset_type ?? "stock";

    deduplicated.push({
      ticker,
      company_name: bestName,
      shares: totalShares,
      average_cost: weightedAvgCost,
      current_price: bestPrice,
      previous_close: bestPrevClose > 0 ? bestPrevClose : bestPrice,
      asset_type: assetType,
    });
  }

  return { deduplicated, mergeWarnings };
}

/** Turns raw broker holdings into fully-computed rows ready for upsert. */
export function computeHoldingRows(
  userId: string,
  accountId: string,
  holdings: NormalizedHolding[]
): ComputedHoldingRow[] {
  // Dedup first — guarantees exactly one row per ticker so the upsert batch
  // can never trigger "ON CONFLICT DO UPDATE command cannot affect row a second time".
  const { deduplicated } = deduplicateHoldings(holdings);
  const now = new Date().toISOString();
  return deduplicated.map((h) => {
    const marketValue = h.shares * h.current_price;
    const invested = h.average_cost * h.shares;
    const dayChange = (h.current_price - h.previous_close) * h.shares;
    return {
      user_id: userId,
      account_id: accountId,
      ticker: h.ticker.toUpperCase(),
      company_name: h.company_name,
      shares: h.shares,
      average_cost: h.average_cost,
      current_price: h.current_price,
      market_value: marketValue,
      day_change: dayChange,
      day_change_pct:
        h.previous_close > 0 ? ((h.current_price - h.previous_close) / h.previous_close) * 100 : 0,
      total_gain_loss: marketValue - invested,
      total_gain_loss_pct: invested > 0 ? ((marketValue - invested) / invested) * 100 : 0,
      asset_type: h.asset_type,
      updated_at: now,
    };
  });
}

/**
 * Safely replace an account's holdings WITHOUT a destructive delete-then-insert
 * window.
 *
 * Strategy (idempotent, no all-or-nothing gap):
 *   1. UPSERT every current row (onConflict account_id,ticker) — existing
 *      positions are updated in place, new ones inserted. At no point does the
 *      account drop to zero holdings.
 *   2. DELETE only the rows whose ticker is no longer present (closed positions).
 *
 * Requires a UNIQUE(account_id, ticker) constraint (added in the schema).
 */
export async function replaceAccountHoldings(
  supabase: SupabaseClient,
  accountId: string,
  rows: ComputedHoldingRow[]
): Promise<{ upserted: number; removed: number }> {
  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("holdings")
      .upsert(rows, { onConflict: "account_id,ticker" });
    if (upsertError) throw new Error(`Holdings upsert failed: ${upsertError.message}`);
  }

  const keepTickers = rows.map((r) => r.ticker);

  // Delete stale rows for this account. If the new set is empty, this clears all.
  let removed = 0;
  if (keepTickers.length > 0) {
    const { data, error } = await supabase
      .from("holdings")
      .delete()
      .eq("account_id", accountId)
      .not("ticker", "in", `(${keepTickers.map((t) => `"${t}"`).join(",")})`)
      .select("id");
    if (error) throw new Error(`Stale holdings cleanup failed: ${error.message}`);
    removed = data?.length ?? 0;
  } else {
    const { data, error } = await supabase
      .from("holdings")
      .delete()
      .eq("account_id", accountId)
      .select("id");
    if (error) throw new Error(`Holdings clear failed: ${error.message}`);
    removed = data?.length ?? 0;
  }

  return { upserted: rows.length, removed };
}

/** Recomputes and stores today's portfolio snapshot from current holdings. */
export async function savePortfolioSnapshot(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data: holdings } = await supabase
    .from("holdings")
    .select("market_value, average_cost, shares")
    .eq("user_id", userId);

  if (!holdings) return;

  const totalValue = holdings.reduce((s, h) => s + (Number(h.market_value) || 0), 0);
  const totalInvested = holdings.reduce(
    (s, h) => s + (Number(h.average_cost) || 0) * (Number(h.shares) || 0),
    0
  );

  await supabase.from("portfolio_snapshots").upsert(
    {
      user_id: userId,
      total_value: totalValue,
      total_gain_loss: totalValue - totalInvested,
      snapshot_date: new Date().toISOString().split("T")[0],
    },
    { onConflict: "user_id,snapshot_date" }
  );
}
