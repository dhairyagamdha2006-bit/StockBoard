import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getSchwabAuthUrl, exchangeSchwabCode } from "@/lib/brokers/schwab";
import { encrypt } from "@/lib/utils/encryption";
import { enforceRateLimit } from "@/lib/utils/rateLimit";
import { BrokerNotConfiguredError } from "@/lib/env";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "schwab_oauth_state";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(req, {
    scope: "connect-schwab",
    limit: 20,
    windowMs: 5 * 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "initiate") {
      // CSRF protection: random state echoed back by Schwab, bound to an
      // httpOnly cookie we verify on callback.
      const state = randomBytes(16).toString("hex");
      const authUrl = getSchwabAuthUrl(state);
      const res = NextResponse.json({ authUrl });
      res.cookies.set(STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return res;
    }

    if (action === "callback") {
      const code = req.nextUrl.searchParams.get("code");
      const state = req.nextUrl.searchParams.get("state");
      const expectedState = req.cookies.get(STATE_COOKIE)?.value;

      if (!code) return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
      if (!state || !expectedState || state !== expectedState) {
        return NextResponse.json(
          { error: "OAuth state mismatch — possible CSRF. Please retry the connection." },
          { status: 400 }
        );
      }

      const { accessToken, refreshToken, expiresIn } = await exchangeSchwabCode(code);
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const { error } = await supabase.from("broker_accounts").upsert(
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
      if (error) return NextResponse.json({ error: "Failed to save connection" }, { status: 500 });

      const res = NextResponse.json({ success: true });
      res.cookies.delete(STATE_COOKIE);
      return res;
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    if (err instanceof BrokerNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Schwab connection failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
