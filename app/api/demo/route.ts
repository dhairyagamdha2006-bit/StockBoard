import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { seedDemoData, clearDemoData } from "@/lib/demo/seed";
import { enforceRateLimit } from "@/lib/utils/rateLimit";

export const dynamic = "force-dynamic";

/** Load demo holdings so the dashboard can be explored without a real broker. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = enforceRateLimit(req, {
    scope: "demo",
    limit: 10,
    windowMs: 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const serviceClient = (await createServiceClient()) as unknown as SupabaseClient;
  try {
    const { holdings } = await seedDemoData(serviceClient, user.id);
    return NextResponse.json({ success: true, holdings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to seed demo data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Remove demo holdings/accounts. */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = enforceRateLimit(req, {
    scope: "demo",
    limit: 10,
    windowMs: 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const serviceClient = (await createServiceClient()) as unknown as SupabaseClient;
  await clearDemoData(serviceClient, user.id);
  return NextResponse.json({ success: true });
}
