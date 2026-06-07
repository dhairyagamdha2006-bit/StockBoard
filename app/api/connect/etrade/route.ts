import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getETradeRequestToken, getETradeAccessToken } from "@/lib/brokers/etrade";
import { encrypt } from "@/lib/utils/encryption";
import { enforceRateLimit } from "@/lib/utils/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = enforceRateLimit(req, {
    scope: "connect-etrade",
    limit: 20,
    windowMs: 5 * 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const action = req.nextUrl.searchParams.get("action");

  if (action === "initiate") {
    const { oauthToken, oauthTokenSecret, authorizeUrl } = await getETradeRequestToken();

    const response = NextResponse.json({ authorizeUrl, oauthToken });
    response.cookies.set("etrade_token_secret", oauthTokenSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
    });
    return response;
  }

  if (action === "callback") {
    const oauthToken = req.nextUrl.searchParams.get("oauth_token") ?? "";
    const verifier = req.nextUrl.searchParams.get("oauth_verifier") ?? "";
    const oauthTokenSecret = req.cookies.get("etrade_token_secret")?.value ?? "";

    if (!verifier || !oauthTokenSecret) {
      return NextResponse.json({ error: "Missing OAuth parameters" }, { status: 400 });
    }

    const { accessToken, accessTokenSecret } = await getETradeAccessToken(
      oauthToken,
      oauthTokenSecret,
      verifier
    );

    const encryptedToken = encrypt(accessToken);
    const encryptedSecret = encrypt(accessTokenSecret);

    await supabase.from("broker_accounts").upsert(
      {
        user_id: user.id,
        broker_name: "etrade",
        access_token: encryptedToken,
        refresh_token: encryptedSecret,
        connection_type: "oauth",
        status: "active",
      },
      { onConflict: "user_id,broker_name" }
    );

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
