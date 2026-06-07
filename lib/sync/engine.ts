import type { SupabaseClient } from "@supabase/supabase-js";
import type { BrokerAccount } from "@/types";
import { decrypt, encrypt } from "@/lib/utils/encryption";
import { fetchRobinhoodHoldings, type NormalizedHolding } from "@/lib/brokers/robinhood";
import { fetchETradeHoldings } from "@/lib/brokers/etrade";
import { fetchSchwabHoldings, refreshSchwabToken } from "@/lib/brokers/schwab";
import { isRobinhoodExperimentalEnabled } from "@/lib/env";
import { computeHoldingRows, replaceAccountHoldings, savePortfolioSnapshot } from "./holdings";

export interface SyncResult {
  accountId: string;
  broker: string;
  ok: boolean;
  count?: number;
  removed?: number;
  error?: string;
  skipped?: boolean;
}

/** Insert a sync_logs row. Best-effort — never throws (logging must not break sync). */
async function recordSyncLog(
  supabase: SupabaseClient,
  account: BrokerAccount,
  result: SyncResult
): Promise<void> {
  const status = result.skipped ? "skipped" : result.ok ? "success" : "failed";
  try {
    await supabase.from("sync_logs").insert({
      user_id: account.user_id,
      account_id: account.id,
      broker_name: account.broker_name,
      status,
      holdings_synced: result.count ?? 0,
      holdings_removed: result.removed ?? 0,
      error_message: result.error ?? null,
    });
  } catch {
    // sync_logs table may not exist yet on older DBs — ignore.
  }
}

/**
 * Sync a single broker account. Runs entirely server-side with whatever
 * Supabase client is passed in (service-role for cron, user-scoped for manual).
 *
 * Failure-safe: holdings are only mutated AFTER a successful broker fetch, using
 * upsert-then-delete-stale. If the broker API fails, we throw before any write,
 * so the user's existing holdings are preserved untouched.
 *
 * Never throws — always returns a structured result and records a sync_log so
 * batch callers can count real successes and users can see why a sync failed.
 */
export async function syncBrokerAccount(
  supabase: SupabaseClient,
  account: BrokerAccount
): Promise<SyncResult> {
  const result = await runSync(supabase, account);
  await recordSyncLog(supabase, account, result);
  return result;
}

async function runSync(supabase: SupabaseClient, account: BrokerAccount): Promise<SyncResult> {
  const base: SyncResult = { accountId: account.id, broker: account.broker_name, ok: false };

  try {
    let holdings: NormalizedHolding[];

    switch (account.broker_name) {
      case "robinhood": {
        if (!isRobinhoodExperimentalEnabled()) {
          return { ...base, skipped: true, error: "Robinhood experimental integration disabled" };
        }
        if (!account.access_token) return { ...base, skipped: true, error: "Not connected" };
        holdings = await fetchRobinhoodHoldings(decrypt(account.access_token));
        break;
      }

      case "etrade": {
        if (!account.access_token || !account.refresh_token) {
          return { ...base, skipped: true, error: "Not connected" };
        }
        holdings = await fetchETradeHoldings(
          decrypt(account.access_token),
          decrypt(account.refresh_token) // stored token secret
        );
        break;
      }

      case "schwab": {
        if (!account.access_token) return { ...base, skipped: true, error: "Not connected" };
        let accessToken = decrypt(account.access_token);

        // Refresh if expired (or about to expire within 60s).
        const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
        if (expiresAt && expiresAt - Date.now() < 60_000 && account.refresh_token) {
          const refreshed = await refreshSchwabToken(decrypt(account.refresh_token));
          accessToken = refreshed.accessToken;
          await supabase
            .from("broker_accounts")
            .update({
              access_token: encrypt(refreshed.accessToken),
              refresh_token: encrypt(refreshed.refreshToken),
              token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
            })
            .eq("id", account.id);
        }

        holdings = await fetchSchwabHoldings(accessToken);
        break;
      }

      case "fidelity":
        // Fidelity is CSV-import only; nothing to pull from an API.
        return { ...base, ok: true, skipped: true, error: "CSV import only" };

      default:
        return { ...base, error: `Unknown broker: ${account.broker_name}` };
    }

    // Only reached after a SUCCESSFUL fetch — safe to mutate holdings now.
    const rows = computeHoldingRows(account.user_id, account.id, holdings);
    const { upserted, removed } = await replaceAccountHoldings(supabase, account.id, rows);

    await supabase
      .from("broker_accounts")
      .update({ last_synced_at: new Date().toISOString(), status: "active" })
      .eq("id", account.id);

    // Snapshot reflects the user's FULL portfolio, recomputed after each broker.
    await savePortfolioSnapshot(supabase, account.user_id);

    return { ...base, ok: true, count: upserted, removed };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    // Mark the account errored so the UI can surface a reconnect prompt.
    // Existing holdings are intentionally left intact.
    await supabase.from("broker_accounts").update({ status: "error" }).eq("id", account.id);
    return { ...base, ok: false, error: message };
  }
}

/** Sync many accounts and report how many actually succeeded. */
export async function syncAccounts(
  supabase: SupabaseClient,
  accounts: BrokerAccount[]
): Promise<{ results: SyncResult[]; succeeded: number; total: number }> {
  const results = await Promise.all(accounts.map((a) => syncBrokerAccount(supabase, a)));
  // Count only real successes (skipped CSV accounts don't count as failures).
  const succeeded = results.filter((r) => r.ok && !r.skipped).length;
  return { results, succeeded, total: accounts.length };
}
