import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/prices/market";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { isValidTicker } from "@/lib/utils/validation";
import { isAlpacaConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, { scope: "market-quote", limit: 60, windowMs: 60_000, userId: user.id });
  if (limited) return limited;

  const symbolRaw = req.nextUrl.searchParams.get("symbol") ?? "";
  if (!isValidTicker(symbolRaw)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  const symbol = symbolRaw.toUpperCase();

  // Alpaca not configured → honest "unavailable" (503), distinct from a symbol
  // that genuinely has no data (404). The UI shows different copy for each and
  // never crashes.
  if (!isAlpacaConfigured()) {
    return NextResponse.json(
      { error: "Market price data is unavailable. Check Alpaca API keys.", reason: "alpaca_unavailable" },
      { status: 503 }
    );
  }

  try {
    const quote = await getQuote(symbol);
    if (!quote) {
      return NextResponse.json({ error: "No market data available for this symbol." }, { status: 404 });
    }
    return NextResponse.json({ quote });
  } catch {
    return NextResponse.json(
      { error: "Market price data is unavailable. Check Alpaca API keys.", reason: "alpaca_unavailable" },
      { status: 503 }
    );
  }
}
