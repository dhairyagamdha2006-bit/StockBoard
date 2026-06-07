import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the server Supabase module (avoids `server-only` + next/headers in tests).
const getUser = vi.fn();
const serviceUpsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
  createServiceClient: async () => ({
    from: () => ({ upsert: serviceUpsert }),
  }),
}));

// Mock Alpaca so no network/credentials are needed.
const getLatestBars = vi.fn();
vi.mock("@/lib/prices/alpaca", () => ({
  getLatestBars: (...a: unknown[]) => getLatestBars(...a),
}));

import { GET } from "@/app/api/prices/route";

function req(qs: string) {
  return new NextRequest(`http://localhost/api/prices${qs}`);
}

beforeEach(() => {
  getUser.mockReset();
  getLatestBars.mockReset();
  serviceUpsert.mockClear();
});

describe("GET /api/prices", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("?tickers=AAPL"));
    expect(res.status).toBe(401);
  });

  it("400s when no valid tickers are supplied", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await GET(req("?tickers=" + encodeURIComponent("!!!,@@@")));
    expect(res.status).toBe(400);
  });

  it("returns quotes and writes the cache via the service-role client", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    getLatestBars.mockResolvedValue(
      new Map([["AAPL", { price: 150, prevClose: 140, change: 10, changePct: 7.14 }]])
    );

    const res = await GET(req("?tickers=aapl,bad;ticker"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.AAPL.price).toBe(150);
    // Only the valid ticker is queried.
    expect(getLatestBars).toHaveBeenCalledWith(["AAPL"]);
    // Cache write happened through the service-role client.
    expect(serviceUpsert).toHaveBeenCalledTimes(1);
  });
});
