import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getETradeRequestToken, getETradeAccessToken } from "@/lib/brokers/etrade";
import { encrypt } from "@/lib/utils/encryption";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { BrokerNotConfiguredError } from "@/lib/env";

export const dynamic = "force-dynamic";

const SECRET_COOKIE = "etrade_token_secret";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, {
    scope: "connect-etrade",
    limit: 20,
    windowMs: 5 * 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "initiate") {
      const { oauthToken, oauthTokenSecret, authorizeUrl } = await getETradeRequestToken();

      const response = NextResponse.json({ authorizeUrl, oauthToken });
      // The request-token secret is the CSRF binding for OAuth 1.0a — httpOnly.
      response.cookies.set(SECRET_COOKIE, oauthTokenSecret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return response;
    }

    if (action === "callback") {
      const oauthToken = req.nextUrl.searchParams.get("oauth_token") ?? "";
      const verifier = req.nextUrl.searchParams.get("oauth_verifier") ?? "";
      const oauthTokenSecret = req.cookies.get(SECRET_COOKIE)?.value ?? "";

      if (!verifier || !oauthTokenSecret) {
        return NextResponse.json(
          { error: "Missing OAuth parameters — please restart the connection." },
          { status: 400 }
        );
      }

      const { accessToken, accessTokenSecret } = await getETradeAccessToken(
        oauthToken,
        oauthTokenSecret,
        verifier
      );

      const { error } = await supabase.from("broker_accounts").upsert(
        {
          user_id: user.id,
          broker_name: "etrade",
          access_token: encrypt(accessToken),
          refresh_token: encrypt(accessTokenSecret),
          connection_type: "oauth",
          status: "active",
        },
        { onConflict: "user_id,broker_name" }
      );
      if (error) return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });

      const res = NextResponse.json({ success: true });
      res.cookies.delete(SECRET_COOKIE);
      return res;
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    if (err instanceof BrokerNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "E*TRADE connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
