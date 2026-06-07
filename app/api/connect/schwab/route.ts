import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSchwabAuthUrl, exchangeSchwabCode } from "@/lib/brokers/schwab";
import { encrypt } from "@/lib/utils/encryption";
import { enforceRateLimit } from "@/lib/utils/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = enforceRateLimit(req, {
    scope: "connect-schwab",
    limit: 20,
    windowMs: 5 * 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const action = req.nextUrl.searchParams.get("action");

  if (action === "initiate") {
    const authUrl = getSchwabAuthUrl();
    return NextResponse.json({ authUrl });
  }

  if (action === "callback") {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

    const { accessToken, refreshToken, expiresIn } = await exchangeSchwabCode(code);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await supabase.from("broker_accounts").upsert(
      {
        user_id: user.id,
        broker_name: "schwab",
        access_token: encrypt(accessToken),
        refresh_token: encrypt(refreshToken),
        token_expires_at: expiresAt,
        connection_type: "oauth",
        status: "active",
      },
      { onConflict: "user_id,broker_name" }
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
