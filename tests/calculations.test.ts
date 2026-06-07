import { describe, it, expect } from "vitest";
import { calculatePortfolioStats, groupByBroker } from "@/lib/utils/calculations";
import type { Holding } from "@/types";

function holding(partial: Partial<Holding>): Holding {
  return {
    id: "h",
    user_id: "u",
    account_id: "a",
    ticker: "AAPL",
    shares: 10,
    asset_type: "stock",
    updated_at: "",
    created_at: "",
    ...partial,
  } as Holding;
}

describe("calculatePortfolioStats", () => {
  it("aggregates value, invested, return and day gain", () => {
    const holdings = [
      holding({ market_value: 1500, average_cost: 100, shares: 10, day_change: 100 }),
      holding({ ticker: "MSFT", market_value: 2000, average_cost: 150, shares: 10, day_change: -50 }),
    ];
    const stats = calculatePortfolioStats(holdings);
    expect(stats.totalValue).toBe(3500);
    expect(stats.totalInvested).toBe(2500); // 1000 + 1500
    expect(stats.totalReturn).toBe(1000);
    expect(stats.totalReturnPct).toBeCloseTo(40);
    expect(stats.dayGain).toBe(50);
    expect(stats.positionCount).toBe(2);
  });

  it("handles an empty portfolio without NaN", () => {
    const stats = calculatePortfolioStats([]);
    expect(stats.totalValue).toBe(0);
    expect(stats.totalReturnPct).toBe(0);
    expect(stats.dayGainPct).toBe(0);
  });
});

describe("groupByBroker", () => {
  it("buckets holdings by broker name", () => {
    const holdings = [
      holding({ broker_accounts: { broker_name: "robinhood" } as Holding["broker_accounts"] }),
      holding({ ticker: "MSFT", broker_accounts: { broker_name: "robinhood" } as Holding["broker_accounts"] }),
      holding({ ticker: "VOO", broker_accounts: { broker_name: "schwab" } as Holding["broker_accounts"] }),
    ];
    const grouped = groupByBroker(holdings);
    expect(grouped.get("robinhood")).toHaveLength(2);
    expect(grouped.get("schwab")).toHaveLength(1);
  });

  it("falls back to 'unknown' when no broker is attached", () => {
    expect(groupByBroker([holding({})]).get("unknown")).toHaveLength(1);
  });
});
