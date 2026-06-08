import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrokerName } from "@/types";
import { computeHoldingRows } from "@/lib/sync/holdings";
import type { NormalizedHolding } from "@/lib/brokers/robinhood";

/**
 * Demo mode — lets recruiters explore a populated dashboard without connecting a
 * real brokerage. Everything seeded here is clearly fake and fully removable.
 *
 * Demo accounts are stored with NO access token, so the sync engine treats them
 * as "not connected" and never overwrites or deletes the seeded holdings.
 */

export const DEMO_TIME_MARKER = "stockboard-demo";

interface DemoAccountSeed {
  broker: BrokerName;
  connectionType: "credentials" | "oauth" | "csv";
  holdings: NormalizedHolding[];
}

const DEMO_ACCOUNTS: DemoAccountSeed[] = [
  {
    broker: "robinhood",
    connectionType: "credentials",
    holdings: [
      { ticker: "AAPL", company_name: "Apple Inc.", shares: 40, average_cost: 165.2, current_price: 212.45, previous_close: 209.8, asset_type: "stock" },
      { ticker: "NVDA", company_name: "NVIDIA Corp.", shares: 25, average_cost: 78.4, current_price: 131.6, previous_close: 134.9, asset_type: "stock" },
      { ticker: "TSLA", company_name: "Tesla Inc.", shares: 18, average_cost: 242.1, current_price: 221.35, previous_close: 218.05, asset_type: "stock" },
      { ticker: "MSFT", company_name: "Microsoft Corp.", shares: 22, average_cost: 310.5, current_price: 438.2, previous_close: 441.1, asset_type: "stock" },
    ],
  },
  {
    broker: "schwab",
    connectionType: "oauth",
    holdings: [
      { ticker: "VOO", company_name: "Vanguard S&P 500 ETF", shares: 60, average_cost: 388.7, current_price: 512.9, previous_close: 510.2, asset_type: "etf" },
      { ticker: "SCHD", company_name: "Schwab US Dividend Equity ETF", shares: 120, average_cost: 72.3, current_price: 81.45, previous_close: 81.1, asset_type: "etf" },
      { ticker: "AMZN", company_name: "Amazon.com Inc.", shares: 30, average_cost: 128.9, current_price: 197.6, previous_close: 195.4, asset_type: "stock" },
    ],
  },
];

/** Insert demo broker accounts + holdings + a 30-day snapshot history. */
export async function seedDemoData(
  supabase: SupabaseClient,
  userId: string
): Promise<{ holdings: number; skipped: string[] }> {
  let totalHoldings = 0;
  const skipped: string[] = [];

  // Never clobber a REAL connection. A broker is "real" if it has OAuth tokens
  // OR is a CSV import (token-less but real, persisted user data). Demo seeding
  // must skip those so it can't overwrite a user's imported holdings.
  const { data: existing } = await supabase
    .from("broker_accounts")
    .select("broker_name, access_token, refresh_token, connection_type")
    .eq("user_id", userId);
  const realConnections = new Set(
    (existing ?? [])
      .filter((a) => a.access_token || a.refresh_token || a.connection_type === "csv")
      .map((a) => a.broker_name as string)
  );

  for (const seed of DEMO_ACCOUNTS) {
    if (realConnections.has(seed.broker)) {
      // A genuine connected account exists for this broker — leave it alone.
      skipped.push(seed.broker);
      continue;
    }

    const { data: account, error } = await supabase
      .from("broker_accounts")
      .upsert(
        {
          user_id: userId,
          broker_name: seed.broker,
          // No tokens — keeps the sync engine from touching demo holdings.
          access_token: null,
          refresh_token: null,
          connection_type: seed.connectionType,
          status: "active",
          // Explicit demo marker. This is the ONLY thing demo cleanup keys off —
          // a real CSV import (also token-less) is never mistaken for demo data.
          is_demo: true,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,broker_name" }
      )
      .select()
      .single();

    if (error || !account) continue;

    const rows = computeHoldingRows(userId, account.id, seed.holdings);
    await supabase.from("holdings").upsert(rows, { onConflict: "account_id,ticker" });
    totalHoldings += rows.length;
  }

  await seedSnapshotHistory(supabase, userId);

  return { holdings: totalHoldings, skipped };
}

/** Deterministic 30-day value curve so the performance chart has demo history. */
async function seedSnapshotHistory(supabase: SupabaseClient, userId: string): Promise<void> {
  // Current total invested/value derived from the seed above.
  const allHoldings = DEMO_ACCOUNTS.flatMap((a) => a.holdings);
  const currentValue = allHoldings.reduce((s, h) => s + h.shares * h.current_price, 0);
  const invested = allHoldings.reduce((s, h) => s + h.shares * h.average_cost, 0);

  const rows = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    // Smooth deterministic curve from invested → current value (no Math.random).
    const t = (30 - i) / 30;
    const eased = t * t * (3 - 2 * t); // smoothstep
    const value = invested + (currentValue - invested) * eased;
    rows.push({
      user_id: userId,
      total_value: Math.round(value * 100) / 100,
      total_gain_loss: Math.round((value - invested) * 100) / 100,
      snapshot_date: d.toISOString().split("T")[0],
      is_demo: true, // so clearDemoData can remove exactly these rows
    });
  }

  if (rows.length > 0) {
    await supabase.from("portfolio_snapshots").upsert(rows, { onConflict: "user_id,snapshot_date" });
  }
}

/**
 * Returns the user's demo broker-account ids.
 *
 * Demo accounts are identified by the explicit `is_demo` flag set at seed time.
 * We deliberately do NOT key off "token-less" anymore: a real CSV import is also
 * token-less, and the old heuristic would wrongly classify (and then DELETE) a
 * CSV-imported Robinhood/Schwab account on demo-clear.
 *
 * Back-compat: if the `is_demo` column doesn't exist yet (migration not applied),
 * we fall back to the old heuristic but EXCLUDE `connection_type = 'csv'` so CSV
 * imports are never wiped.
 */
async function getDemoAccountIds(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const brokers = DEMO_ACCOUNTS.map((a) => a.broker);

  const withFlag = await supabase
    .from("broker_accounts")
    .select("id, is_demo")
    .eq("user_id", userId)
    .eq("is_demo", true);

  if (!withFlag.error) {
    return (withFlag.data ?? []).map((a) => a.id as string);
  }

  // Older DB without the is_demo column — safe fallback that never touches CSV.
  const { data: accounts } = await supabase
    .from("broker_accounts")
    .select("id, access_token, refresh_token, connection_type")
    .eq("user_id", userId)
    .in("broker_name", brokers);

  return (accounts ?? [])
    .filter((a) => !a.access_token && !a.refresh_token && a.connection_type !== "csv")
    .map((a) => a.id as string);
}

/** True if the user currently has demo data loaded. */
export async function isDemoActive(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const ids = await getDemoAccountIds(supabase, userId);
  return ids.length > 0;
}

/**
 * Remove all demo accounts (and cascade their holdings) for a user, plus the
 * demo-seeded snapshot history so it can't linger as the user's "real" chart.
 * Real CSV/OAuth accounts and real snapshots are left untouched.
 */
export async function clearDemoData(supabase: SupabaseClient, userId: string): Promise<void> {
  const ids = await getDemoAccountIds(supabase, userId);
  if (ids.length > 0) {
    await supabase.from("holdings").delete().in("account_id", ids);
    await supabase.from("broker_accounts").delete().in("id", ids);
  }

  // Remove demo snapshots (best-effort; column may be absent on older DBs).
  try {
    await supabase.from("portfolio_snapshots").delete().eq("user_id", userId).eq("is_demo", true);
  } catch {
    /* older DB without is_demo on snapshots — nothing to clean */
  }
}
