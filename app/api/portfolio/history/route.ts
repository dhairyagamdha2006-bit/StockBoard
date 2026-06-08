import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBars, type Bar } from "@/lib/prices/market";
import {
  aggregateSharesByTicker,
  buildHistoryPoints,
  isPortfolioRange,
  mapWithConcurrency,
} from "@/lib/portfolio/history";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const CONCURRENCY = 5;

/**
 * Portfolio performance history for the dashboard chart.
 *
 * Returns the value of the user's CURRENT holdings over the selected range,
 * computed from each ticker's historical close prices (Alpaca). This makes the
 * chart respond correctly to 1W/1M/3M/1Y and reflect a real CSV import — unlike
 * the old version, which only plotted daily portfolio_snapshots and therefore
 * looked empty (or like leftover demo data) right after an import.
 *
 * Honest framing: this is "current holdings valued over time", not a
 * reconstructed historical account balance (we have no transaction history).
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, {
    scope: "portfolio-history",
    limit: 30,
    windowMs: 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const range = req.nextUrl.searchParams.get("range") ?? "1M";
  if (!isPortfolioRange(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  // Current holdings (RLS-scoped to this user).
  const { data: holdings, error } = await supabase.from("holdings").select("ticker, shares");
  if (error) {
    logger.error("Failed to load holdings for portfolio history", {
      route: "/api/portfolio/history",
    });
    return NextResponse.json({ error: "Failed to load holdings" }, { status: 500 });
  }

  const sharesByTicker = aggregateSharesByTicker(
    (holdings ?? []).map((h) => ({ ticker: h.ticker as string, shares: Number(h.shares) }))
  );

  if (sharesByTicker.size === 0) {
    return NextResponse.json({ points: [], source: "empty", partial: false, missingTickers: [] });
  }

  // Fetch historical bars per ticker with bounded concurrency. getBars never
  // throws (it returns [] when Alpaca is unavailable), so missing tickers are
  // reported as `partial` rather than crashing the chart.
  const tickers = Array.from(sharesByTicker.keys());
  const barsByTicker = new Map<string, Bar[]>();
  await mapWithConcurrency(tickers, CONCURRENCY, async (ticker) => {
    const bars = await getBars(ticker, range);
    barsByTicker.set(ticker, bars);
  });

  const history = buildHistoryPoints(sharesByTicker, barsByTicker);
  return NextResponse.json(history);
}
