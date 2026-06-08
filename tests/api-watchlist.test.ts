import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const upsert = vi.fn(async () => ({ error: null }));
const del = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({ upsert, delete: del }),
  }),
}));

import { POST, DELETE } from "@/app/api/watchlist/route";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/watchlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  upsert.mockClear();
  del.mockClear();
});

describe("POST /api/watchlist", () => {
  it("rejects an invalid symbol", async () => {
    const res = await POST(jsonReq({ symbol: "not a ticker!!" }));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("adds a valid symbol (uppercased)", async () => {
    const res = await POST(jsonReq({ symbol: "aapl", name: "Apple Inc." }));
    expect(res.status).toBe(200);
    expect((await res.json()).symbol).toBe("AAPL");
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

describe("DELETE /api/watchlist", () => {
  it("rejects an invalid symbol", async () => {
    const res = await DELETE(new NextRequest("http://localhost/api/watchlist?symbol=__bad__", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });

  it("removes a valid symbol", async () => {
    const res = await DELETE(new NextRequest("http://localhost/api/watchlist?symbol=MSFT", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(del).toHaveBeenCalledTimes(1);
  });
});
