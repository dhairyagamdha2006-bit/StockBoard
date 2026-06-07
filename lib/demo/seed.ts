import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrokerName } from "@/types";
import { computeHoldingRows, savePortfolioSnapshot } from "@/lib/sync/holdings";
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
export async function seedDemoData(supabase: SupabaseClient, userId: string): Promise<{ holdings: number }> {
  let totalHoldings = 0;

  for (const seed of DEMO_ACCOUNTS) {
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
  await savePortfolioSnapshot(supabase, userId);

  return { holdings: totalHoldings };
}

/** Deterministic 30-day value curve so the performance chart has demo history. */
async function seedSnapshotHistory(supabase: SupabaseClient, userId: string): Promise<void> {
  // Current total invested/value derived from the seed above.
  const allHoldings = DEMO_ACCOUNTS.flatMap((a) => a.holdings);
  const currentValue = allHoldings.reduce((s, h) => s + h.shares * h.current_price, 0);
  const invested = allHoldings.reduce((s, h) => s + h.shares * h.average_cost, 0);

  const rows = [];
  for (let i = 30; i >= 1; i--) {
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
    });
  }

  if (rows.length > 0) {
    await supabase.from("portfolio_snapshots").upsert(rows, { onConflict: "user_id,snapshot_date" });
  }
}

/** Remove all demo accounts (and cascade their holdings) for a user. */
export async function clearDemoData(supabase: SupabaseClient, userId: string): Promise<void> {
  const brokers = DEMO_ACCOUNTS.map((a) => a.broker);
  const { data: accounts } = await supabase
    .from("broker_accounts")
    .select("id")
    .eq("user_id", userId)
    .in("broker_name", brokers)
    .is("access_token", null);

  const ids = (accounts ?? []).map((a) => a.id);
  if (ids.length > 0) {
    await supabase.from("holdings").delete().in("account_id", ids);
    await supabase.from("broker_accounts").delete().in("id", ids);
  }
}
