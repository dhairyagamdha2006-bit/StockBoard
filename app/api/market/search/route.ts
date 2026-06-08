import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAssets } from "@/lib/prices/market";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { isBoundedString } from "@/lib/utils/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, { scope: "market-search", limit: 30, windowMs: 60_000, userId: user.id });
  if (limited) return limited;

  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!isBoundedString(q, 64)) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchAssets(q);
  return NextResponse.json({ results });
}
