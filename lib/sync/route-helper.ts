import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { syncBrokerAccount } from "@/lib/sync/engine";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import type { BrokerAccount, BrokerName } from "@/types";

/**
 * Shared handler for the per-broker manual sync routes.
 *
 * Auth is verified against the signed-in user (user-scoped client), but the
 * actual broker pull + DB write run through the service-role client so the
 * logic is identical to the cron path and never depends on RLS quirks.
 */
export async function handleBrokerSync(
  req: NextRequest,
  broker: BrokerName
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = enforceRateLimit(req, {
    scope: `sync-${broker}`,
    limit: 12,
    windowMs: 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  // Allow an explicit accountId, but always scope to the current user.
  const body = (await req.json().catch(() => ({}))) as { accountId?: string };

  let lookup = supabase
    .from("broker_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("broker_name", broker);
  if (body.accountId) lookup = lookup.eq("id", body.accountId);

  const { data: account } = await lookup.maybeSingle();
  if (!account) {
    return NextResponse.json(
      { error: `${broker} not connected` },
      { status: 400 }
    );
  }

  const serviceClient = (await createServiceClient()) as unknown as SupabaseClient;
  const result = await syncBrokerAccount(serviceClient, account as BrokerAccount);

  if (!result.ok && !result.skipped) {
    return NextResponse.json(
      { success: false, error: result.error ?? "Sync failed" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    count: result.count ?? 0,
    removed: result.removed ?? 0,
    skipped: result.skipped ?? false,
    message: result.skipped ? result.error : undefined,
  });
}
