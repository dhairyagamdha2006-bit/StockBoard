import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearDemoData, isDemoActive, seedDemoData } from "@/lib/demo/seed";

/**
 * Regression tests for the CSV-persistence / demo-isolation bug.
 *
 * Before the fix, demo accounts and CSV imports were both token-less, so the
 * demo-cleanup heuristic ("token-less account on a demo broker") would DELETE a
 * user's real CSV import for Robinhood/Schwab. The fix keys demo cleanup off an
 * explicit `is_demo` flag instead.
 */

interface QueryState {
  table: string;
  op: "select" | "upsert" | "update" | "delete" | null;
  selectCols?: string;
  payload?: unknown;
  eqs: [string, unknown][];
  inArg?: [string, unknown[]];
}

type Resolver = (s: QueryState) => { data: unknown; error: unknown };

function makeClient(resolver: Resolver) {
  const calls: QueryState[] = [];
  function from(table: string) {
    const state: QueryState = { table, op: null, eqs: [] };
    const finalize = () => {
      calls.push({ ...state, eqs: [...state.eqs] });
      return Promise.resolve(resolver(state));
    };
    const q: Record<string, unknown> = {
      select(cols?: string) {
        state.selectCols = cols;
        if (state.op === null) state.op = "select";
        return q;
      },
      upsert(payload: unknown) {
        state.op = "upsert";
        state.payload = payload;
        return q;
      },
      update(payload: unknown) {
        state.op = "update";
        state.payload = payload;
        return q;
      },
      delete() {
        state.op = "delete";
        return q;
      },
      eq(col: string, val: unknown) {
        state.eqs.push([col, val]);
        return q;
      },
      in(col: string, vals: unknown[]) {
        state.inArg = [col, vals];
        return q;
      },
      single: () => finalize(),
      maybeSingle: () => finalize(),
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => finalize().then(onF, onR),
    };
    return q;
  }
  return { client: { from } as unknown as SupabaseClient, calls };
}

describe("clearDemoData — only removes demo data (is_demo path)", () => {
  it("deletes exactly the is_demo accounts, their holdings, and demo snapshots", async () => {
    const { client, calls } = makeClient((s) => {
      if (s.table === "broker_accounts" && s.op === "select" && s.selectCols?.includes("is_demo")) {
        return { data: [{ id: "demo1", is_demo: true }], error: null };
      }
      return { data: null, error: null };
    });

    await clearDemoData(client, "u1");

    const holdingsDelete = calls.find((c) => c.table === "holdings" && c.op === "delete");
    expect(holdingsDelete?.inArg).toEqual(["account_id", ["demo1"]]);

    const accountsDelete = calls.find((c) => c.table === "broker_accounts" && c.op === "delete");
    expect(accountsDelete?.inArg).toEqual(["id", ["demo1"]]);

    const snapDelete = calls.find((c) => c.table === "portfolio_snapshots" && c.op === "delete");
    expect(snapDelete).toBeTruthy();
    expect(snapDelete?.eqs).toEqual(expect.arrayContaining([["is_demo", true]]));
  });

  it("does NOT delete anything when there are no demo accounts (CSV-only user)", async () => {
    const { client, calls } = makeClient((s) => {
      if (s.table === "broker_accounts" && s.op === "select" && s.selectCols?.includes("is_demo")) {
        return { data: [], error: null }; // no is_demo accounts → CSV imports are safe
      }
      return { data: null, error: null };
    });

    await clearDemoData(client, "u1");

    expect(calls.find((c) => c.table === "holdings" && c.op === "delete")).toBeUndefined();
    expect(calls.find((c) => c.table === "broker_accounts" && c.op === "delete")).toBeUndefined();
  });

  it("fallback path (no is_demo column) never deletes a CSV account", async () => {
    const { client, calls } = makeClient((s) => {
      // Simulate the is_demo column not existing yet.
      if (s.table === "broker_accounts" && s.op === "select" && s.selectCols?.includes("is_demo")) {
        return { data: null, error: { message: 'column "is_demo" does not exist' } };
      }
      // Fallback select: a CSV robinhood import + a genuine token-less demo schwab.
      if (s.table === "broker_accounts" && s.op === "select") {
        return {
          data: [
            { id: "csv-rh", access_token: null, refresh_token: null, connection_type: "csv" },
            { id: "demo-schwab", access_token: null, refresh_token: null, connection_type: "oauth" },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    });

    await clearDemoData(client, "u1");

    const accountsDelete = calls.find((c) => c.table === "broker_accounts" && c.op === "delete");
    // Only the token-less non-CSV (demo) account is removed; the CSV import survives.
    expect(accountsDelete?.inArg).toEqual(["id", ["demo-schwab"]]);
  });
});

describe("isDemoActive", () => {
  it("is true when an is_demo account exists, false otherwise", async () => {
    const withDemo = makeClient((s) =>
      s.selectCols?.includes("is_demo") ? { data: [{ id: "d1", is_demo: true }], error: null } : { data: null, error: null }
    );
    expect(await isDemoActive(withDemo.client, "u1")).toBe(true);

    const noDemo = makeClient((s) =>
      s.selectCols?.includes("is_demo") ? { data: [], error: null } : { data: null, error: null }
    );
    expect(await isDemoActive(noDemo.client, "u1")).toBe(false);
  });
});

describe("seedDemoData — never clobbers a real CSV import", () => {
  it("skips a broker that already has a CSV account", async () => {
    const { client, calls } = makeClient((s) => {
      // Existing accounts: a CSV import for robinhood.
      if (s.table === "broker_accounts" && s.op === "select") {
        return {
          data: [{ broker_name: "robinhood", access_token: null, refresh_token: null, connection_type: "csv" }],
          error: null,
        };
      }
      // schwab demo account upsert returns an id.
      if (s.table === "broker_accounts" && s.op === "upsert") {
        return { data: { id: "schwab-demo" }, error: null };
      }
      return { data: null, error: null };
    });

    const { skipped } = await seedDemoData(client, "u1");

    // robinhood (the CSV broker) is skipped, so it's never upserted as demo.
    expect(skipped).toContain("robinhood");
    const upserts = calls.filter((c) => c.table === "broker_accounts" && c.op === "upsert");
    for (const u of upserts) {
      expect((u.payload as { broker_name: string }).broker_name).not.toBe("robinhood");
    }
  });

  it("marks seeded demo accounts with is_demo = true", async () => {
    const { client, calls } = makeClient((s) => {
      if (s.table === "broker_accounts" && s.op === "select") return { data: [], error: null };
      if (s.table === "broker_accounts" && s.op === "upsert") return { data: { id: "acct" }, error: null };
      return { data: null, error: null };
    });

    await seedDemoData(client, "u1");

    const upserts = calls.filter((c) => c.table === "broker_accounts" && c.op === "upsert");
    expect(upserts.length).toBeGreaterThan(0);
    for (const u of upserts) {
      expect((u.payload as { is_demo: boolean }).is_demo).toBe(true);
    }
  });
});
