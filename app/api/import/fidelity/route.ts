import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { parseFidelityCSV } from "@/lib/brokers/fidelity";
import { computeHoldingRows, replaceAccountHoldings, savePortfolioSnapshot } from "@/lib/sync/holdings";
import { enforceRateLimit } from "@/lib/utils/rateLimit";

export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = enforceRateLimit(req, {
    scope: "import-fidelity",
    limit: 20,
    windowMs: 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_CSV_BYTES) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 5 MB" },
      { status: 400 }
    );
  }

  const csvContent = await file.text();
  const holdings = parseFidelityCSV(csvContent);

  if (holdings.length === 0) {
    return NextResponse.json({ error: "No valid holdings found in CSV" }, { status: 400 });
  }

  const preview = formData?.get("preview") === "true";
  if (preview) {
    return NextResponse.json({ holdings, count: holdings.length });
  }

  const { data: account, error: accountError } = await supabase
    .from("broker_accounts")
    .upsert(
      {
        user_id: user.id,
        broker_name: "fidelity",
        connection_type: "csv",
        status: "active",
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id,broker_name" }
    )
    .select()
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Failed to create broker account" }, { status: 500 });
  }

  // Use the service-role client + safe upsert/delete-stale strategy so a partial
  // CSV never wipes the account down to zero holdings mid-write.
  const serviceClient = (await createServiceClient()) as unknown as SupabaseClient;
  const rows = computeHoldingRows(user.id, account.id, holdings);

  try {
    const { upserted, removed } = await replaceAccountHoldings(serviceClient, account.id, rows);
    await savePortfolioSnapshot(serviceClient, user.id);
    return NextResponse.json({ success: true, count: upserted, removed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save holdings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
