import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "./helpers/fakeSupabase";
import type { BrokerAccount } from "@/types";

// Encryption is identity in tests so we don't need real ciphertext.
vi.mock("@/lib/utils/encryption", () => ({
  encrypt: (s: string) => s,
  decrypt: (s: string) => s,
  isEncryptionConfigured: () => true,
}));

// Control Schwab holdings fetch.
const fetchSchwabHoldings = vi.fn();
vi.mock("@/lib/brokers/schwab", () => ({
  fetchSchwabHoldings: (...a: unknown[]) => fetchSchwabHoldings(...a),
  refreshSchwabToken: vi.fn(),
  getSchwabAuthUrl: vi.fn(),
  exchangeSchwabCode: vi.fn(),
}));

import { syncBrokerAccount, syncAccounts } from "@/lib/sync/engine";

const account = (over: Partial<BrokerAccount>): BrokerAccount =>
  ({
    id: "a1",
    user_id: "u1",
    broker_name: "schwab",
    access_token: "tok",
    refresh_token: "ref",
    token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    connection_type: "oauth",
    status: "active",
    created_at: "",
    ...over,
  }) as BrokerAccount;

const sampleHoldings = [
  { ticker: "AAPL", company_name: "Apple", shares: 10, average_cost: 100, current_price: 150, previous_close: 140, asset_type: "stock" },
];

beforeEach(() => {
  fetchSchwabHoldings.mockReset();
});

describe("syncBrokerAccount", () => {
  it("success path: writes holdings, marks active, logs success", async () => {
    fetchSchwabHoldings.mockResolvedValue(sampleHoldings);
    const { client, store } = createFakeSupabase({
      selectData: { holdings: [{ market_value: 1500, average_cost: 100, shares: 10 }] },
    });

    const res = await syncBrokerAccount(client, account({}));

    expect(res.ok).toBe(true);
    expect(res.count).toBe(1);
    const log = store.calls.find((c) => c.table === "sync_logs");
    expect((log!.payload as { status: string }).status).toBe("success");
  });

  it("failure path: keeps existing holdings (no upsert) and logs failed", async () => {
    fetchSchwabHoldings.mockRejectedValue(new Error("Schwab 500"));
    const { client, store } = createFakeSupabase();

    const res = await syncBrokerAccount(client, account({}));

    expect(res.ok).toBe(false);
    // Failure-safe: holdings must NOT have been mutated.
    expect(store.calls.find((c) => c.table === "holdings" && c.op === "upsert")).toBeUndefined();
    // Account marked errored.
    expect(store.calls.find((c) => c.table === "broker_accounts" && c.op === "update")).toBeTruthy();
    const log = store.calls.find((c) => c.table === "sync_logs");
    expect((log!.payload as { status: string }).status).toBe("failed");
  });

  it("skips a not-connected account", async () => {
    const { client } = createFakeSupabase();
    const res = await syncBrokerAccount(client, account({ access_token: null }));
    expect(res.skipped).toBe(true);
    expect(fetchSchwabHoldings).not.toHaveBeenCalled();
  });

  it("never deletes or upserts holdings for a token-less CSV account (Sync Now is safe)", async () => {
    const { client, store } = createFakeSupabase();
    // A CSV import is token-less; syncing it must not touch its holdings.
    const res = await syncBrokerAccount(
      client,
      account({ broker_name: "schwab", connection_type: "csv", access_token: null, refresh_token: null })
    );
    expect(res.skipped).toBe(true);
    expect(store.calls.find((c) => c.table === "holdings" && c.op === "upsert")).toBeUndefined();
    expect(store.calls.find((c) => c.table === "holdings" && c.op === "delete")).toBeUndefined();
  });

  it("treats Fidelity as skipped (CSV-only)", async () => {
    const { client } = createFakeSupabase();
    const res = await syncBrokerAccount(client, account({ broker_name: "fidelity" }));
    expect(res.ok).toBe(true);
    expect(res.skipped).toBe(true);
  });
});

describe("syncAccounts counting", () => {
  it("counts only genuine successes (skips/failures excluded)", async () => {
    fetchSchwabHoldings.mockResolvedValue(sampleHoldings);
    const { client } = createFakeSupabase({
      selectData: { holdings: [{ market_value: 1500, average_cost: 100, shares: 10 }] },
    });

    const { succeeded, total } = await syncAccounts(client, [
      account({ id: "ok" }),
      account({ id: "csv", broker_name: "fidelity" }),
      account({ id: "down", access_token: null }),
    ]);

    expect(total).toBe(3);
    expect(succeeded).toBe(1);
  });
});
