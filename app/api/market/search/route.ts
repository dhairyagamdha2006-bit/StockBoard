import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchAssets } from "@/lib/prices/market";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { isBoundedString } from "@/lib/utils/validation";
import { logger } from "@/lib/utils/logger";

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
    return NextResponse.json({ results: [], source: "fallback" });
  }

  // searchAssets has its own internal fallback + timeout, but we still guard
  // here so the route ALWAYS returns JSON (never a 500/HTML page) — the UI must
  // never be left stuck on "Searching…".
  try {
    const { results, source, warning } = await searchAssets(q);
    return NextResponse.json({ results, source, warning });
  } catch (err) {
    logger.error("Market search failed unexpectedly", {
      route: "/api/market/search",
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({
      results: [],
      source: "fallback",
      warning: "Market search is temporarily unavailable. Please try again.",
    });
  }
}
