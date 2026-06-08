import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const upsert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ upsert }),
  }),
}));

vi.mock("@/lib/utils/encryption", () => ({
  encrypt: (s: string) => s,
  decrypt: (s: string) => s,
}));

const exchangeSchwabCode = vi.fn();
vi.mock("@/lib/brokers/schwab", () => ({
  getSchwabAuthUrl: (state: string) => `https://schwab.example/auth?state=${state}`,
  exchangeSchwabCode: (...a: unknown[]) => exchangeSchwabCode(...a),
}));

import { GET } from "@/app/api/connect/schwab/route";

function callbackReq(qs: string, cookie?: string) {
  return new NextRequest(`http://localhost/api/connect/schwab${qs}`, {
    headers: cookie ? { cookie } : {},
  });
}

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  exchangeSchwabCode.mockResolvedValue({ accessToken: "at", refreshToken: "rt", expiresIn: 1800 });
  upsert.mockClear();
});

describe("Schwab OAuth callback state validation", () => {
  it("fails when state is missing", async () => {
    const res = await GET(callbackReq("?action=callback&code=abc", "schwab_oauth_state=xyz"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/state/i);
  });

  it("fails when state does not match the cookie", async () => {
    const res = await GET(callbackReq("?action=callback&code=abc&state=WRONG", "schwab_oauth_state=xyz"));
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("succeeds when state matches the cookie", async () => {
    const res = await GET(callbackReq("?action=callback&code=abc&state=xyz", "schwab_oauth_state=xyz"));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(exchangeSchwabCode).toHaveBeenCalledWith("abc");
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
