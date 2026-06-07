import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncAccounts } from "@/lib/sync/engine";
import type { BrokerAccount } from "@/types";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { getCronSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Sync ALL active broker accounts.
 *
 * Two callers:
 *   1. Vercel Cron — authenticates with `Authorization: Bearer ${CRON_SECRET}`
 *      and syncs every active account across all users.
 *   2. A signed-in user — syncs only their own active accounts.
 *
 * In BOTH cases the actual sync runs entirely server-side with the
 * service-role client (`syncAccounts`), so it never depends on forwarding the
 * caller's auth cookie to sub-requests. The response reports the number of
 * accounts that genuinely synced (not just HTTP 200s).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  // getCronSecret() throws if CRON_SECRET is unset/weak — but only when a cron
  // request is actually being attempted (Authorization header present).
  let isVercelCron = false;
  if (authHeader) {
    try {
      isVercelCron = authHeader === `Bearer ${getCronSecret()}`;
    } catch {
      isVercelCron = false;
    }
  }

  let userId: string | null = null;
  if (!isVercelCron) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;

    // Rate-limit manual user-triggered full syncs (cron is exempt).
    const limited = await enforceRateLimit(req, {
      scope: "sync-all",
      limit: 6,
      windowMs: 60_000,
      userId,
    });
    if (limited) return limited;
  }

  // The sync itself always uses the service-role client.
  const serviceClient = (await createServiceClient()) as unknown as SupabaseClient;
  let query = serviceClient.from("broker_accounts").select("*").neq("status", "disconnected");
  if (userId) query = query.eq("user_id", userId);

  const { data: accounts, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ synced: 0, total: 0, results: [], message: "No accounts to sync" });
  }

  const { results, succeeded, total } = await syncAccounts(
    serviceClient,
    accounts as BrokerAccount[]
  );

  return NextResponse.json({ synced: succeeded, total, results });
}

// Vercel Cron issues GET requests; reuse the same logic.
export async function GET(req: NextRequest) {
  return POST(req);
}
