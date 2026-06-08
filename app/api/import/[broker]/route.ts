import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseBrokerCsv, CsvParseError } from "@/lib/brokers/csv-parsers";
import {
  computeHoldingRows,
  deduplicateHoldings,
  replaceAccountHoldings,
  savePortfolioSnapshot,
} from "@/lib/sync/holdings";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { isBrokerName } from "@/lib/utils/validation";
import { logger } from "@/lib/utils/logger";
import type { BrokerName } from "@/types";

export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Generic CSV import for any broker. CSV is the reliable, no-approval-needed
 * connection method for all four brokers.
 *
 * - `preview=true` parses and returns holdings without writing anything.
 * - Otherwise it imports: it preserves an existing OAuth connection unless the
 *   user explicitly chooses to replace it (`mode=replace-oauth`).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ broker: string }> }) {
  const { broker: brokerParam } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isBrokerName(brokerParam)) {
    return NextResponse.json({ error: "Unsupported broker" }, { status: 400 });
  }
  const broker = brokerParam as BrokerName;

  const limited = await enforceRateLimit(req, {
    scope: `import-${broker}`,
    limit: 20,
    windowMs: 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  const preview = formData?.get("preview") === "true";
  const mode = (formData?.get("mode") as string | null) ?? null; // null | keep-oauth | replace-oauth

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "File must be between 1 byte and 5 MB" }, { status: 400 });
  }
  const looksCsv = file.name.toLowerCase().endsWith(".csv") || (file.type || "").includes("csv");
  if (!looksCsv) {
    return NextResponse.json({ error: "Please upload a .csv file" }, { status: 400 });
  }

  // Parse (never logs file contents).
  let parsed;
  try {
    parsed = parseBrokerCsv(broker, await file.text());
  } catch (err) {
    const message = err instanceof CsvParseError ? err.message : "Could not read this CSV.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Deduplicate before preview so the count and holdings list reflect what
  // will actually be written, and merge warnings are surfaced to the user.
  const { deduplicated: previewHoldings, mergeWarnings } = deduplicateHoldings(parsed.holdings);
  const allWarnings = [...parsed.warnings, ...mergeWarnings];

  if (preview) {
    return NextResponse.json({
      holdings: previewHoldings,
      count: previewHoldings.length,
      warnings: allWarnings,
      parser: parsed.parser,
    });
  }

  // Look at any existing connection for this broker.
  const { data: existing } = await supabase
    .from("broker_accounts")
    .select("id, access_token, refresh_token")
    .eq("user_id", user.id)
    .eq("broker_name", broker)
    .maybeSingle();

  const hasOAuth = !!existing && (!!existing.access_token || !!existing.refresh_token);

  // If an OAuth connection exists, require an explicit choice before proceeding.
  if (hasOAuth && mode !== "keep-oauth" && mode !== "replace-oauth") {
    return NextResponse.json(
      {
        requiresConfirmation: true,
        message:
          "This broker is already connected with OAuth. Do you want to update holdings from CSV while keeping OAuth, or replace OAuth with CSV?",
        options: ["keep-oauth", "replace-oauth"],
      },
      { status: 409 }
    );
  }

  let accountId: string;
  let connectionKept = false;

  if (hasOAuth && mode === "keep-oauth") {
    // Keep the OAuth tokens; only refresh the imported holdings + timestamp.
    await supabase
      .from("broker_accounts")
      .update({ last_synced_at: new Date().toISOString(), status: "active" })
      .eq("id", existing!.id)
      .eq("user_id", user.id);
    accountId = existing!.id;
    connectionKept = true;
  } else {
    // New account, existing CSV account, or explicit replace-oauth → CSV account.
    const { data: account, error } = await supabase
      .from("broker_accounts")
      .upsert(
        {
          user_id: user.id,
          broker_name: broker,
          connection_type: "csv",
          status: "active",
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          // Explicitly NOT demo — a CSV import is real, persisted user data and
          // must survive "Clear demo data" and never be treated as demo.
          is_demo: false,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,broker_name" }
      )
      .select()
      .single();
    if (error || !account) {
      return NextResponse.json({ error: "Failed to create broker account" }, { status: 500 });
    }
    accountId = account.id;
  }

  // Write holdings with the safe upsert/delete-stale strategy (service-role).
  const serviceClient = (await createServiceClient()) as unknown as SupabaseClient;
  try {
    const rows = computeHoldingRows(user.id, accountId, parsed.holdings);
    const { upserted, removed } = await replaceAccountHoldings(serviceClient, accountId, rows);
    await savePortfolioSnapshot(serviceClient, user.id);

    // Record the import in sync_logs (best-effort; never logs file data).
    try {
      const now = new Date().toISOString();
      await serviceClient.from("sync_logs").insert({
        user_id: user.id,
        account_id: accountId,
        broker_name: broker,
        status: "success",
        message: `CSV import (${parsed.parser}) — ${upserted} holdings`,
        holdings_synced: upserted,
        holdings_removed: removed,
        started_at: now,
        finished_at: now,
      });
    } catch {
      // sync_logs may not have the new columns on an older DB — ignore.
    }

    return NextResponse.json({
      success: true,
      count: upserted,
      removed,
      warnings: allWarnings,
      connectionKept,
    });
  } catch (err) {
    logger.error("CSV import write failed", { broker, route: "/api/import/[broker]" });
    const message = err instanceof Error ? err.message : "Failed to save holdings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
