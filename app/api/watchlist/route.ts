import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { isValidTicker, isBoundedString } from "@/lib/utils/validation";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("watchlist_items")
    .select("id, symbol, name, created_at")
    .order("created_at", { ascending: false });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, { scope: "watchlist", limit: 60, windowMs: 60_000, userId: user.id });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as { symbol?: unknown; name?: unknown };
  if (!isValidTicker(body.symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  const symbol = (body.symbol as string).toUpperCase();
  const name = isBoundedString(body.name, 120) ? (body.name as string) : symbol;

  const { error } = await supabase
    .from("watchlist_items")
    .upsert({ user_id: user.id, symbol, name }, { onConflict: "user_id,symbol" });
  if (error) return NextResponse.json({ error: "Could not add to watchlist" }, { status: 500 });

  return NextResponse.json({ success: true, symbol });
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const symbolRaw = req.nextUrl.searchParams.get("symbol") ?? "";
  if (!isValidTicker(symbolRaw)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("user_id", user.id)
    .eq("symbol", symbolRaw.toUpperCase());
  if (error) return NextResponse.json({ error: "Could not remove from watchlist" }, { status: 500 });

  return NextResponse.json({ success: true });
}
