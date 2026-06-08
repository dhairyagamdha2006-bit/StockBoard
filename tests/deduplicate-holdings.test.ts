/**
 * Regression tests for deduplicateHoldings and the upsert-safety guarantee.
 *
 * Root cause: Robinhood (and other broker) CSVs can contain more than one row
 * for the same ticker. Passing multiple rows with the same (account_id, ticker)
 * into a Supabase upsert with onConflict:"account_id,ticker" causes Postgres to
 * raise: "ON CONFLICT DO UPDATE command cannot affect row a second time".
 *
 * Fix: deduplicateHoldings merges duplicates before any DB write.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { deduplicateHoldings, computeHoldingRows } from "@/lib/sync/holdings";
import { parseBrokerCsv } from "@/lib/brokers/csv-parsers";
import { replaceAccountHoldings } from "@/lib/sync/holdings";
import { createFakeSupabase } from "./helpers/fakeSupabase";
import type { NormalizedHolding } from "@/lib/brokers/robinhood";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function holding(
  ticker: string,
  overrides: Partial<NormalizedHolding> = {}
): NormalizedHolding {
  return {
    ticker,
    company_name: ticker,
    shares: 10,
    average_cost: 100,
    current_price: 150,
    previous_close: 140,
    asset_type: "stock",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deduplicateHoldings — unit tests
// ---------------------------------------------------------------------------

describe("deduplicateHoldings", () => {
  it("passes through a list with no duplicates unchanged", () => {
    const { deduplicated, mergeWarnings } = deduplicateHoldings([
      holding("AAPL"),
      holding("NVDA"),
    ]);
    expect(deduplicated).toHaveLength(2);
    expect(mergeWarnings).toHaveLength(0);
  });

  it("merges two MSFT rows into exactly one", () => {
    const { deduplicated, mergeWarnings } = deduplicateHoldings([
      holding("MSFT", { shares: 5, average_cost: 250, current_price: 380 }),
      holding("MSFT", { shares: 3, average_cost: 260, current_price: 380 }),
    ]);
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].ticker).toBe("MSFT");
    expect(mergeWarnings).toHaveLength(1);
    expect(mergeWarnings[0]).toMatch(/2 MSFT rows were merged/i);
  });

  it("sums shares across duplicate rows", () => {
    const { deduplicated } = deduplicateHoldings([
      holding("MSFT", { shares: 5 }),
      holding("MSFT", { shares: 3 }),
    ]);
    expect(deduplicated[0].shares).toBe(8);
  });

  it("calculates the share-weighted average cost correctly", () => {
    // 5 shares @ 250 + 3 shares @ 260 = (1250 + 780) / 8 = 253.75
    const { deduplicated } = deduplicateHoldings([
      holding("MSFT", { shares: 5, average_cost: 250 }),
      holding("MSFT", { shares: 3, average_cost: 260 }),
    ]);
    expect(deduplicated[0].average_cost).toBeCloseTo(253.75, 5);
  });

  it("picks the largest non-zero current_price", () => {
    const { deduplicated } = deduplicateHoldings([
      holding("TSLA", { shares: 2, current_price: 0 }),
      holding("TSLA", { shares: 3, current_price: 220 }),
    ]);
    expect(deduplicated[0].current_price).toBe(220);
  });

  it("picks the largest non-zero previous_close", () => {
    const { deduplicated } = deduplicateHoldings([
      holding("TSLA", { shares: 2, previous_close: 0 }),
      holding("TSLA", { shares: 3, previous_close: 215 }),
    ]);
    expect(deduplicated[0].previous_close).toBe(215);
  });

  it("drops zero-value duplicate rows (shares=0) before merging", () => {
    // NVDA: one real row + one dust/zero row → single merged row with real shares only
    const { deduplicated } = deduplicateHoldings([
      holding("NVDA", { shares: 25, average_cost: 78.4, current_price: 131.6 }),
      holding("NVDA", { shares: 0, average_cost: 0, current_price: 0 }),
    ]);
    // The zero-share row is dropped by the shares <= 0 guard
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].shares).toBe(25);
  });

  it("drops rows with shares <= 0", () => {
    const { deduplicated } = deduplicateHoldings([
      holding("JUNK", { shares: 0 }),
      holding("JUNK", { shares: -1 }),
    ]);
    expect(deduplicated).toHaveLength(0);
  });

  it("drops dust rows where shares are negligible and there is no price signal", () => {
    const { deduplicated } = deduplicateHoldings([
      holding("DUST", { shares: 1e-10, average_cost: 0, current_price: 0 }),
    ]);
    expect(deduplicated).toHaveLength(0);
  });

  it("normalises tickers to uppercase before grouping (lowercase input)", () => {
    const { deduplicated } = deduplicateHoldings([
      holding("aapl", { shares: 5 }),
      holding("AAPL", { shares: 3 }),
    ]);
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].ticker).toBe("AAPL");
    expect(deduplicated[0].shares).toBe(8);
  });

  it("picks the longest company_name when merging", () => {
    const { deduplicated } = deduplicateHoldings([
      holding("MSFT", { company_name: "MSFT" }),
      holding("MSFT", { company_name: "Microsoft Corporation" }),
    ]);
    expect(deduplicated[0].company_name).toBe("Microsoft Corporation");
  });

  it("preserves asset_type from the first non-empty value", () => {
    const { deduplicated } = deduplicateHoldings([
      holding("ETH", { asset_type: "crypto" }),
      holding("ETH", { asset_type: "crypto" }),
    ]);
    expect(deduplicated[0].asset_type).toBe("crypto");
  });
});

// ---------------------------------------------------------------------------
// computeHoldingRows — dedup is applied internally
// ---------------------------------------------------------------------------

describe("computeHoldingRows — duplicate protection", () => {
  it("returns exactly one row per ticker even with duplicate input", () => {
    const rows = computeHoldingRows("user-1", "acct-1", [
      holding("MSFT", { shares: 5, average_cost: 250, current_price: 380 }),
      holding("MSFT", { shares: 3, average_cost: 260, current_price: 380 }),
      holding("AAPL", { shares: 10 }),
    ]);
    const tickers = rows.map((r) => r.ticker);
    expect(tickers).toHaveLength(2);
    expect(new Set(tickers).size).toBe(2); // unique
  });

  it("computes market_value based on merged share count", () => {
    const rows = computeHoldingRows("u", "a", [
      holding("MSFT", { shares: 5, average_cost: 250, current_price: 380 }),
      holding("MSFT", { shares: 3, average_cost: 260, current_price: 380 }),
    ]);
    // 8 shares × 380 = 3040
    expect(rows[0].shares).toBe(8);
    expect(rows[0].market_value).toBeCloseTo(3040);
  });
});

// ---------------------------------------------------------------------------
// replaceAccountHoldings — receives unique tickers only
// ---------------------------------------------------------------------------

describe("replaceAccountHoldings — receives unique tickers only", () => {
  it("does not pass duplicate tickers to the upsert batch", async () => {
    const { client, store } = createFakeSupabase({
      deleteReturn: { holdings: [] },
    });

    // Simulate what the route does: dedup first, then computeHoldingRows
    const { deduplicated } = deduplicateHoldings([
      holding("MSFT", { shares: 5 }),
      holding("MSFT", { shares: 3 }),
      holding("AAPL"),
    ]);
    const rows = computeHoldingRows("user-1", "acct-1", deduplicated);
    await replaceAccountHoldings(client, "acct-1", rows);

    const upsertCall = store.calls.find((c) => c.op === "upsert" && c.table === "holdings");
    expect(upsertCall).toBeTruthy();
    const payload = upsertCall!.payload as { ticker: string }[];
    const tickers = payload.map((r) => r.ticker);
    // Exactly 2 unique tickers, no duplicates
    expect(tickers).toHaveLength(2);
    expect(new Set(tickers).size).toBe(2);
    expect(tickers).toContain("MSFT");
    expect(tickers).toContain("AAPL");
  });
});

// ---------------------------------------------------------------------------
// Robinhood CSV regression — the fixture that caused the production error
// ---------------------------------------------------------------------------

describe("Robinhood CSV with duplicate tickers — regression", () => {
  it("parses the duplicate-positions fixture without error and merges MSFT", () => {
    const csv = readFileSync(
      join(process.cwd(), "tests/fixtures/robinhood-duplicate-positions.csv"),
      "utf8"
    );
    // parseBrokerCsv should not throw
    const { holdings, warnings } = parseBrokerCsv("robinhood", csv);
    // Raw parse gives us all rows (parsers don't dedup)
    const msftRows = holdings.filter((h) => h.ticker === "MSFT");
    expect(msftRows.length).toBeGreaterThanOrEqual(1);

    // After dedup: exactly one MSFT
    const { deduplicated, mergeWarnings } = deduplicateHoldings(holdings);
    const mergedMsft = deduplicated.filter((h) => h.ticker === "MSFT");
    expect(mergedMsft).toHaveLength(1);
    expect(mergedMsft[0].shares).toBe(8); // 5 + 3
    expect(mergedMsft[0].average_cost).toBeCloseTo(253.75, 5);

    // NVDA zero-share row was dropped, original 25-share row survives
    const mergedNvda = deduplicated.filter((h) => h.ticker === "NVDA");
    expect(mergedNvda).toHaveLength(1);
    expect(mergedNvda[0].shares).toBe(25);

    // Warnings emitted for the merge
    expect(mergeWarnings.some((w) => w.includes("MSFT"))).toBe(true);

    // allWarnings combines parser warnings + merge warnings
    const allWarnings = [...warnings, ...mergeWarnings];
    expect(allWarnings).toEqual(expect.arrayContaining([expect.stringMatching(/MSFT/)]));
  });

  it("produces a upsert-safe row set from the duplicate Robinhood CSV (no duplicate tickers)", () => {
    const csv = readFileSync(
      join(process.cwd(), "tests/fixtures/robinhood-duplicate-positions.csv"),
      "utf8"
    );
    const { holdings } = parseBrokerCsv("robinhood", csv);
    // computeHoldingRows internally deduplicates
    const rows = computeHoldingRows("user-1", "acct-1", holdings);
    const tickers = rows.map((r) => r.ticker);
    // Uniqueness guarantee — the batch can safely be sent to Postgres
    expect(new Set(tickers).size).toBe(tickers.length);
    // MSFT, AAPL, NVDA — three unique tickers
    expect(tickers).toHaveLength(3);
  });
});
