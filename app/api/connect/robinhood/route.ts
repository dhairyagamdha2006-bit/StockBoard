import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { robinhoodLogin } from "@/lib/brokers/robinhood";
import { encrypt } from "@/lib/utils/encryption";
import { isBoundedString, isValidMfaCode } from "@/lib/utils/validation";
import { enforceRateLimit } from "@/lib/utils/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Brute-force protection: credential submission is tightly limited.
  const limited = enforceRateLimit(req, {
    scope: "connect-robinhood",
    limit: 8,
    windowMs: 5 * 60_000,
    userId: user.id,
  });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    username?: unknown;
    password?: unknown;
    mfaCode?: unknown;
  };

  if (!isBoundedString(body.username, 256) || !isBoundedString(body.password, 256)) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }
  if (body.mfaCode !== undefined && body.mfaCode !== "" && !isValidMfaCode(body.mfaCode)) {
    return NextResponse.json({ error: "Invalid MFA code" }, { status: 400 });
  }

  const result = await robinhoodLogin(
    body.username,
    body.password,
    typeof body.mfaCode === "string" ? body.mfaCode : undefined
  );

  if (result.mfaRequired) {
    return NextResponse.json({ mfaRequired: true });
  }

  if (result.error || !result.token) {
    return NextResponse.json({ error: result.error ?? "Login failed" }, { status: 401 });
  }

  const encryptedToken = encrypt(result.token);

  const { error: upsertError } = await supabase.from("broker_accounts").upsert(
    {
      user_id: user.id,
      broker_name: "robinhood",
      access_token: encryptedToken,
      connection_type: "credentials",
      status: "active",
      last_synced_at: null,
    },
    { onConflict: "user_id,broker_name" }
  );

  if (upsertError) {
    return NextResponse.json({ error: "Failed to save account" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
