import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// --- Mock the data layer ---------------------------------------------------
let existingAccount: { id: string; access_token: string | null; refresh_token: string | null } | null = null;
const upsertSelectSingle = vi.fn(async () => ({ data: { id: "acct-new" }, error: null }));
const updateResult = vi.fn(async () => ({ error: null }));

function userClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from() {
      const b: Record<string, unknown> = {};
      Object.assign(b, {
        select: () => b,
        eq: () => b,
        upsert: () => b,
        update: () => b,
        maybeSingle: async () => ({ data: existingAccount, error: null }),
        single: () => upsertSelectSingle(),
        then: (res: (v: unknown) => unknown) => updateResult().then(res),
      });
      return b;
    },
  };
}

const serviceInsert = vi.fn(async () => ({ error: null }));
function serviceClient() {
  return { from: () => ({ insert: serviceInsert }) };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => userClient(),
  createServiceClient: async () => serviceClient(),
}));

// Holdings DB writes are covered by holdings-db.test.ts — stub them here.
// Use importOriginal so deduplicateHoldings (a pure function added in the
// duplicate-ticker fix) runs for real inside the route under test.
vi.mock("@/lib/sync/holdings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sync/holdings")>();
  return {
    ...actual,
    computeHoldingRows: (_u: string, _a: string, holdings: unknown[]) => holdings,
    replaceAccountHoldings: async (_c: unknown, _a: string, rows: unknown[]) => ({
      upserted: (rows as unknown[]).length,
      removed: 0,
    }),
    savePortfolioSnapshot: async () => {},
  };
});

import { POST } from "@/app/api/import/[broker]/route";

const csv = readFileSync(join(process.cwd(), "tests/fixtures/robinhood-positions.csv"), "utf8");

function importReq(form: Record<string, string>, fileContent = csv) {
  const fd = new FormData();
  fd.append("file", new File([fileContent], "positions.csv", { type: "text/csv" }));
  for (const [k, v] of Object.entries(form)) fd.append(k, v);
  return new NextRequest("http://localhost/api/import/robinhood", { method: "POST", body: fd });
}

const ctx = (broker: string) => ({ params: Promise.resolve({ broker }) });

beforeEach(() => {
  existingAccount = null;
  upsertSelectSingle.mockClear();
  updateResult.mockClear();
  serviceInsert.mockClear();
});

describe("POST /api/import/[broker]", () => {
  it("rejects an unsupported broker", async () => {
    const res = await POST(importReq({}), ctx("webull"));
    expect(res.status).toBe(400);
  });

  it("preview returns parsed holdings without writing", async () => {
    const res = await POST(importReq({ preview: "true" }), ctx("robinhood"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.holdings.map((h: { ticker: string }) => h.ticker).sort()).toEqual(["AAPL", "NVDA"]);
    expect(upsertSelectSingle).not.toHaveBeenCalled();
  });

  it("imports into a new CSV account", async () => {
    const res = await POST(importReq({}), ctx("robinhood"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
    expect(upsertSelectSingle).toHaveBeenCalledTimes(1); // created the CSV account
  });

  it("requires confirmation when an OAuth account already exists", async () => {
    existingAccount = { id: "acct-oauth", access_token: "tok", refresh_token: "ref" };
    const res = await POST(importReq({}), ctx("robinhood"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.requiresConfirmation).toBe(true);
    // Must NOT have replaced the account.
    expect(upsertSelectSingle).not.toHaveBeenCalled();
  });

  it("keep-oauth updates holdings without wiping tokens", async () => {
    existingAccount = { id: "acct-oauth", access_token: "tok", refresh_token: "ref" };
    const res = await POST(importReq({ mode: "keep-oauth" }), ctx("robinhood"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.connectionKept).toBe(true);
    // keep-oauth path uses update(), not upsert(...).select().single().
    expect(upsertSelectSingle).not.toHaveBeenCalled();
  });
});
