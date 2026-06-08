import { describe, it, expect } from "vitest";
import {
  aggregateSharesByTicker,
  buildHistoryPoints,
  mapWithConcurrency,
  isPortfolioRange,
} from "@/lib/portfolio/history";
import type { Bar } from "@/lib/prices/market";

const bar = (t: string, c: number): Bar => ({ t, c });

describe("aggregateSharesByTicker", () => {
  it("sums shares for the same ticker across accounts and uppercases", () => {
    const m = aggregateSharesByTicker([
      { ticker: "aapl", shares: 5 },
      { ticker: "AAPL", shares: 3 },
      { ticker: "MSFT", shares: 2 },
    ]);
    expect(m.get("AAPL")).toBe(8);
    expect(m.get("MSFT")).toBe(2);
  });

  it("ignores non-positive or invalid share counts", () => {
    const m = aggregateSharesByTicker([
      { ticker: "AAPL", shares: 0 },
      { ticker: "TSLA", shares: -4 },
      { ticker: "NVDA", shares: Number.NaN },
    ]);
    expect(m.size).toBe(0);
  });
});

describe("buildHistoryPoints", () => {
  it("returns empty source when there are no holdings", () => {
    const res = buildHistoryPoints(new Map(), new Map());
    expect(res.source).toBe("empty");
    expect(res.points).toEqual([]);
    expect(res.partial).toBe(false);
  });

  it("aggregates multiple holdings by date (shares × close summed)", () => {
    const shares = new Map([
      ["AAPL", 10],
      ["MSFT", 2],
    ]);
    const bars = new Map<string, Bar[]>([
      ["AAPL", [bar("2026-01-01", 100), bar("2026-01-02", 110)]],
      ["MSFT", [bar("2026-01-01", 200), bar("2026-01-02", 210)]],
    ]);
    const res = buildHistoryPoints(shares, bars);
    expect(res.source).toBe("current_holdings_market_history");
    expect(res.partial).toBe(false);
    // 2026-01-01: 10*100 + 2*200 = 1400 ; 2026-01-02: 10*110 + 2*210 = 1520
    expect(res.points).toEqual([
      { date: "2026-01-01", value: 1400 },
      { date: "2026-01-02", value: 1520 },
    ]);
  });

  it("marks partial=true and lists tickers with no bars (without crashing)", () => {
    const shares = new Map([
      ["AAPL", 10],
      ["ZZZZ", 5],
    ]);
    const bars = new Map<string, Bar[]>([
      ["AAPL", [bar("2026-01-01", 100)]],
      ["ZZZZ", []], // missing history
    ]);
    const res = buildHistoryPoints(shares, bars);
    expect(res.partial).toBe(true);
    expect(res.missingTickers).toEqual(["ZZZZ"]);
    // Value reflects only AAPL: 10 * 100
    expect(res.points).toEqual([{ date: "2026-01-01", value: 1000 }]);
  });

  it("forward-fills a missing day with the ticker's last known close", () => {
    const shares = new Map([
      ["AAPL", 1],
      ["MSFT", 1],
    ]);
    const bars = new Map<string, Bar[]>([
      // MSFT has no bar on 2026-01-02 → forward-fill 200 from 2026-01-01
      ["AAPL", [bar("2026-01-01", 100), bar("2026-01-02", 130)]],
      ["MSFT", [bar("2026-01-01", 200)]],
    ]);
    const res = buildHistoryPoints(shares, bars);
    // 2026-01-01: 100+200=300 ; 2026-01-02: 130 + (filled)200 = 330
    expect(res.points).toEqual([
      { date: "2026-01-01", value: 300 },
      { date: "2026-01-02", value: 330 },
    ]);
    expect(res.partial).toBe(false); // MSFT had at least one bar
  });

  it("returns no points but a partial flag when every ticker is missing bars", () => {
    const shares = new Map([["AAPL", 10]]);
    const bars = new Map<string, Bar[]>([["AAPL", []]]);
    const res = buildHistoryPoints(shares, bars);
    expect(res.points).toEqual([]);
    expect(res.partial).toBe(true);
    expect(res.source).toBe("current_holdings_market_history");
  });
});

describe("mapWithConcurrency", () => {
  it("maps every item and preserves order", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });

  it("never exceeds the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

describe("isPortfolioRange", () => {
  it("accepts the four supported ranges and rejects others", () => {
    expect(isPortfolioRange("1W")).toBe(true);
    expect(isPortfolioRange("1Y")).toBe(true);
    expect(isPortfolioRange("1D")).toBe(false); // not supported for portfolio history
    expect(isPortfolioRange("5Y")).toBe(false);
  });
});
