import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- mock Supabase server client -------------------------------------------
const getUser = vi.fn();
let holdingsData: { ticker: string; shares: number }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (_table: string) => ({
      // route does: await supabase.from("holdings").select("ticker, shares")
      select: async () => ({ data: holdingsData, error: null }),
    }),
  }),
}));

// --- mock market bars ------------------------------------------------------
const getBars = vi.fn();
vi.mock("@/lib/prices/market", () => ({
  getBars: (...a: unknown[]) => getBars(...a),
}));

import { GET } from "@/app/api/portfolio/history/route";

function req(qs = "") {
  return new NextRequest(`http://localhost/api/portfolio/history${qs}`);
}

beforeEach(() => {
  getUser.mockReset();
  getBars.mockReset();
  holdingsData = [];
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("GET /api/portfolio/history", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("?range=1M"));
    expect(res.status).toBe(401);
  });

  it("400s on an invalid range", async () => {
    const res = await GET(req("?range=5Y"));
    expect(res.status).toBe(400);
  });

  it("returns empty points when the user has no holdings", async () => {
    holdingsData = [];
    const res = await GET(req("?range=1M"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("empty");
    expect(body.points).toEqual([]);
    // getBars should not be called when there are no holdings.
    expect(getBars).not.toHaveBeenCalled();
  });

  it("aggregates multiple holdings into a value series", async () => {
    holdingsData = [
      { ticker: "AAPL", shares: 10 },
      { ticker: "MSFT", shares: 2 },
    ];
    getBars.mockImplementation(async (symbol: string) => {
      if (symbol === "AAPL") return [{ t: "2026-01-01", c: 100 }, { t: "2026-01-02", c: 110 }];
      if (symbol === "MSFT") return [{ t: "2026-01-01", c: 200 }, { t: "2026-01-02", c: 210 }];
      return [];
    });

    const res = await GET(req("?range=1M"));
    const body = await res.json();
    expect(body.source).toBe("current_holdings_market_history");
    expect(body.partial).toBe(false);
    expect(body.points).toEqual([
      { date: "2026-01-01", value: 1400 },
      { date: "2026-01-02", value: 1520 },
    ]);
  });

  it("requests the historical window for the selected range", async () => {
    holdingsData = [{ ticker: "AAPL", shares: 1 }];
    getBars.mockResolvedValue([{ t: "2026-01-01", c: 100 }]);

    await GET(req("?range=1W"));
    expect(getBars).toHaveBeenCalledWith("AAPL", "1W");

    getBars.mockClear();
    await GET(req("?range=1Y"));
    expect(getBars).toHaveBeenCalledWith("AAPL", "1Y");
  });

  it("reports partial=true when some tickers have no bars (no crash)", async () => {
    holdingsData = [
      { ticker: "AAPL", shares: 10 },
      { ticker: "ZZZZ", shares: 5 },
    ];
    getBars.mockImplementation(async (symbol: string) =>
      symbol === "AAPL" ? [{ t: "2026-01-01", c: 100 }] : []
    );

    const res = await GET(req("?range=3M"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.partial).toBe(true);
    expect(body.missingTickers).toContain("ZZZZ");
    expect(body.points).toEqual([{ date: "2026-01-01", value: 1000 }]);
  });
});
