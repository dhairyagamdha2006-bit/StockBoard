import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const searchAssets = vi.fn();
vi.mock("@/lib/prices/market", () => ({
  searchAssets: (...a: unknown[]) => searchAssets(...a),
}));

import { GET } from "@/app/api/market/search/route";

function req(qs: string) {
  return new NextRequest(`http://localhost/api/market/search${qs}`);
}

beforeEach(() => {
  getUser.mockReset();
  searchAssets.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("GET /api/market/search", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("?q=AAPL"));
    expect(res.status).toBe(401);
  });

  it("returns fallback results with a warning when Alpaca is unavailable", async () => {
    searchAssets.mockResolvedValue({
      results: [{ symbol: "AAPL", name: "Apple Inc." }],
      source: "fallback",
      warning: "Live market search is unavailable because Alpaca is not configured. Showing popular fallback symbols.",
    });
    const res = await GET(req("?q=AAPL"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("fallback");
    expect(body.warning).toMatch(/Alpaca/);
    expect(body.results[0].symbol).toBe("AAPL");
  });

  it("always returns JSON (never a 500) even if searchAssets throws", async () => {
    searchAssets.mockRejectedValue(new Error("boom"));
    const res = await GET(req("?q=AAPL"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(body.source).toBe("fallback");
    expect(typeof body.warning).toBe("string");
  });
});
