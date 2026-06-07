import { describe, it, expect } from "vitest";
import { computeHoldingRows } from "@/lib/sync/holdings";
import type { NormalizedHolding } from "@/lib/brokers/robinhood";

const sample: NormalizedHolding[] = [
  {
    ticker: "aapl",
    company_name: "Apple Inc.",
    shares: 10,
    average_cost: 100,
    current_price: 150,
    previous_close: 140,
    asset_type: "stock",
  },
];

describe("computeHoldingRows", () => {
  it("computes market value, day change, and gains correctly", () => {
    const [row] = computeHoldingRows("user-1", "acct-1", sample);

    expect(row.user_id).toBe("user-1");
    expect(row.account_id).toBe("acct-1");
    expect(row.ticker).toBe("AAPL"); // uppercased
    expect(row.market_value).toBe(1500); // 10 * 150
    expect(row.day_change).toBeCloseTo(100); // (150-140)*10
    expect(row.day_change_pct).toBeCloseTo(((150 - 140) / 140) * 100);
    expect(row.total_gain_loss).toBe(500); // 1500 - (100*10)
    expect(row.total_gain_loss_pct).toBeCloseTo(50);
  });

  it("guards against divide-by-zero on previous_close / invested", () => {
    const [row] = computeHoldingRows("u", "a", [
      { ticker: "Z", company_name: "Z", shares: 1, average_cost: 0, current_price: 10, previous_close: 0, asset_type: "stock" },
    ]);
    expect(row.day_change_pct).toBe(0);
    expect(row.total_gain_loss_pct).toBe(0);
  });

  it("returns an empty array for empty input", () => {
    expect(computeHoldingRows("u", "a", [])).toEqual([]);
  });
});
