import { describe, it, expect } from "vitest";
import { replaceAccountHoldings, savePortfolioSnapshot } from "@/lib/sync/holdings";
import type { ComputedHoldingRow } from "@/lib/sync/holdings";
import { createFakeSupabase } from "./helpers/fakeSupabase";

const mkRow = (ticker: string): ComputedHoldingRow => ({
  user_id: "u1",
  account_id: "a1",
  ticker,
  company_name: ticker,
  shares: 1,
  average_cost: 10,
  current_price: 12,
  market_value: 12,
  day_change: 0,
  day_change_pct: 0,
  total_gain_loss: 2,
  total_gain_loss_pct: 20,
  asset_type: "stock",
  updated_at: new Date().toISOString(),
});

describe("replaceAccountHoldings", () => {
  it("upserts current rows then deletes stale ones (no full wipe)", async () => {
    const { client, store } = createFakeSupabase({ deleteReturn: { holdings: [{ id: "x" }] } });
    const rows = [mkRow("AAPL"), mkRow("MSFT")];

    const result = await replaceAccountHoldings(client, "a1", rows);

    const upsert = store.calls.find((c) => c.op === "upsert" && c.table === "holdings");
    expect(upsert).toBeTruthy();
    expect((upsert!.payload as unknown[]).length).toBe(2);
    expect(result.upserted).toBe(2);
    expect(result.removed).toBe(1);
  });

  it("clears all holdings when the new set is empty", async () => {
    const { client, store } = createFakeSupabase({ deleteReturn: { holdings: [{ id: "1" }, { id: "2" }] } });
    const result = await replaceAccountHoldings(client, "a1", []);
    // No upsert when there are no rows.
    expect(store.calls.find((c) => c.op === "upsert")).toBeUndefined();
    expect(result.removed).toBe(2);
  });
});

describe("savePortfolioSnapshot", () => {
  it("computes totals from holdings and upserts a snapshot", async () => {
    const { client, store } = createFakeSupabase({
      selectData: {
        holdings: [
          { market_value: 1500, average_cost: 100, shares: 10 },
          { market_value: 2000, average_cost: 150, shares: 10 },
        ],
      },
    });

    await savePortfolioSnapshot(client, "u1");

    const snap = store.calls.find((c) => c.table === "portfolio_snapshots" && c.op === "upsert");
    expect(snap).toBeTruthy();
    const payload = snap!.payload as { total_value: number; total_gain_loss: number };
    expect(payload.total_value).toBe(3500);
    expect(payload.total_gain_loss).toBe(1000); // 3500 - (1000 + 1500)
  });
});
