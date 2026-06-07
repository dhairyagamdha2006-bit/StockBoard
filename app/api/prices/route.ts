import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getLatestBars } from "@/lib/prices/alpaca";
import { sanitizeTickers } from "@/lib/utils/validation";
import { enforceRateLimit } from "@/lib/utils/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, {
    scope: "prices",
    limit: 60,
    windowMs: 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  // Validate + sanitize the requested tickers (caps count, drops malformed).
  const tickers = sanitizeTickers(req.nextUrl.searchParams.get("tickers"), 100);
  if (tickers.length === 0) {
    return NextResponse.json({ error: "No valid tickers" }, { status: 400 });
  }

  const prices = await getLatestBars(tickers);

  const priceRows = Array.from(prices.entries()).map(([ticker, data]) => ({
    ticker,
    current_price: data.price,
    previous_close: data.prevClose,
    day_change: data.change,
    day_change_pct: data.changePct,
    updated_at: new Date().toISOString(),
  }));

  // Cache writes go through the service-role client. RLS forbids authenticated
  // users from writing price_cache, so this MUST use the privileged client.
  if (priceRows.length > 0) {
    const serviceClient = (await createServiceClient()) as unknown as SupabaseClient;
    await serviceClient.from("price_cache").upsert(priceRows, { onConflict: "ticker" });
  }

  return NextResponse.json(Object.fromEntries(prices));
}
