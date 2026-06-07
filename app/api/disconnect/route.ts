import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isBrokerName } from "@/lib/utils/validation";
import { enforceRateLimit } from "@/lib/utils/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Disconnect a broker for the current user.
 *
 * We revoke locally by wiping the stored tokens, marking the account
 * `disconnected`, and purging its holdings. Reconnecting simply re-runs the
 * connect flow, which upserts the same (user_id, broker_name) row back to
 * `active` with fresh tokens.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, {
    scope: "disconnect",
    limit: 20,
    windowMs: 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { broker?: unknown };
  if (!isBrokerName(body.broker)) {
    return NextResponse.json({ error: "Invalid broker" }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("broker_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("broker_name", body.broker)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Use service-role for the cascade cleanup so it can't be blocked by RLS edge
  // cases, but everything is still scoped to this user's account id.
  const serviceClient = (await createServiceClient()) as unknown as SupabaseClient;

  await serviceClient.from("holdings").delete().eq("account_id", account.id);
  const { error } = await serviceClient
    .from("broker_accounts")
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      status: "disconnected",
      last_synced_at: null,
    })
    .eq("id", account.id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
