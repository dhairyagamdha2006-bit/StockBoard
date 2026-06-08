import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  searchAssets,
  getPopularAssets,
  FALLBACK_ASSETS,
  ALPACA_UNAVAILABLE_WARNING,
} from "@/lib/prices/market";

/**
 * These tests exercise the fallback path. Tests that need Alpaca to "succeed"
 * are ordered LAST because a successful asset load populates a module-level
 * cache for the rest of the file.
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Valid-looking Alpaca creds by default (so authHeaders doesn't throw); the
  // fetch mock decides whether Alpaca "works".
  process.env.ALPACA_API_KEY = "test_alpaca_key_value";
  process.env.ALPACA_SECRET_KEY = "test_alpaca_secret_value";
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
});

describe("searchAssets — fallback when Alpaca is unavailable", () => {
  it("returns AAPL from the fallback list when Alpaca fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { results, source, warning } = await searchAssets("AAPL");
    expect(source).toBe("fallback");
    expect(warning).toBe(ALPACA_UNAVAILABLE_WARNING);
    expect(results.some((r) => r.symbol === "AAPL")).toBe(true);
  });

  it("matches a company name (apple → AAPL) from the fallback list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { results } = await searchAssets("apple");
    expect(results.some((r) => r.symbol === "AAPL")).toBe(true);
  });

  it("matches tsla → TSLA from the fallback list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { results } = await searchAssets("tsla");
    expect(results[0].symbol).toBe("TSLA");
  });

  it("falls back with a warning when Alpaca credentials are missing", async () => {
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    const { results, source, warning } = await searchAssets("NVDA");
    expect(source).toBe("fallback");
    expect(warning).toBe(ALPACA_UNAVAILABLE_WARNING);
    expect(results.some((r) => r.symbol === "NVDA")).toBe(true);
  });

  it("returns empty (no warning) for an empty query", async () => {
    const { results } = await searchAssets("   ");
    expect(results).toEqual([]);
  });
});

describe("getPopularAssets", () => {
  it("includes the expected popular symbols", () => {
    const symbols = getPopularAssets().map((a) => a.symbol);
    for (const s of ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "SPY", "VOO"]) {
      expect(symbols).toContain(s);
    }
  });

  it("only references symbols present in the fallback list", () => {
    const fb = new Set(FALLBACK_ASSETS.map((a) => a.symbol));
    for (const a of getPopularAssets()) expect(fb.has(a.symbol)).toBe(true);
  });
});

describe("searchAssets — Alpaca available (runs last; populates cache)", () => {
  it("returns source 'alpaca' when the asset list loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { symbol: "AAPL", name: "Apple Inc.", tradable: true },
          { symbol: "ABNB", name: "Airbnb Inc.", tradable: true },
        ],
      })
    );
    const { results, source } = await searchAssets("AAPL");
    expect(source).toBe("alpaca");
    expect(results[0].symbol).toBe("AAPL");
  });
});
