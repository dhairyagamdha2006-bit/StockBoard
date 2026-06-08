import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBars, isBarRange } from "@/lib/prices/market";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { isValidTicker } from "@/lib/utils/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, { scope: "market-bars", limit: 60, windowMs: 60_000, userId: user.id });
  if (limited) return limited;

  const symbolRaw = req.nextUrl.searchParams.get("symbol") ?? "";
  const range = req.nextUrl.searchParams.get("range") ?? "1M";
  if (!isValidTicker(symbolRaw)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  if (!isBarRange(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const bars = await getBars(symbolRaw.toUpperCase(), range);
  return NextResponse.json({ bars });
}
