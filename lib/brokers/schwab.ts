import type { NormalizedHolding } from "./robinhood";
import { getBrokerOAuthEnv } from "@/lib/env";

const SCHWAB_AUTH_URL = "https://api.schwabapi.com/v1/oauth/authorize";
const SCHWAB_TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token";
const SCHWAB_API_BASE = "https://api.schwabapi.com/trader/v1";

/** Build the Schwab authorize URL. `state` is required for CSRF protection. */
export function getSchwabAuthUrl(state: string): string {
  const { clientId, redirectUri } = getBrokerOAuthEnv("schwab");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "readonly",
    state,
  });
  return `${SCHWAB_AUTH_URL}?${params.toString()}`;
}

function basicAuthHeader(): string {
  const { clientId, clientSecret } = getBrokerOAuthEnv("schwab");
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function exchangeSchwabCode(
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const { redirectUri } = getBrokerOAuthEnv("schwab");

  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    // Never log/throw the response body — it can echo the auth code.
    throw new Error(`Schwab token exchange failed (status ${res.status}).`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshSchwabToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    throw new Error(`Schwab token refresh failed (status ${res.status}).`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in,
  };
}

export async function fetchSchwabHoldings(accessToken: string): Promise<NormalizedHolding[]> {
  const accountsRes = await fetch(`${SCHWAB_API_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!accountsRes.ok) throw new Error(`Failed to fetch Schwab accounts (status ${accountsRes.status}).`);
  const accounts = await accountsRes.json();
  const holdings: NormalizedHolding[] = [];

  for (const account of accounts) {
    const accountId = account.hashValue ?? account.accountId;
    const posRes = await fetch(`${SCHWAB_API_BASE}/accounts/${accountId}/positions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!posRes.ok) continue;
    const posData = await posRes.json();
    const positions = posData?.securitiesAccount?.positions ?? [];

    for (const pos of positions) {
      const instr = pos.instrument ?? {};
      const longQty = parseFloat(pos.longQuantity ?? pos.quantity ?? "0") || 0;
      holdings.push({
        ticker: instr.symbol ?? "",
        company_name: instr.description ?? instr.symbol,
        shares: longQty,
        average_cost: parseFloat(pos.averagePrice ?? "0") || 0,
        current_price: longQty > 0 ? (parseFloat(pos.marketValue ?? "0") || 0) / longQty : 0,
        previous_close: parseFloat(pos.previousCloseValue ?? "0") || 0,
        asset_type:
          instr.assetType === "ETF"
            ? "etf"
            : instr.assetType === "OPTION"
            ? "option"
            : "stock",
      });
    }
  }

  return holdings;
}
