import type { NormalizedHolding } from "./robinhood";

const SCHWAB_AUTH_URL = "https://api.schwabapi.com/v1/oauth/authorize";
const SCHWAB_TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token";
const SCHWAB_API_BASE = "https://api.schwabapi.com/trader/v1";

export function getSchwabAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SCHWAB_CLIENT_ID!,
    redirect_uri: process.env.SCHWAB_REDIRECT_URI!,
    scope: "readonly",
  });
  return `${SCHWAB_AUTH_URL}?${params.toString()}`;
}

export async function exchangeSchwabCode(
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const credentials = Buffer.from(
    `${process.env.SCHWAB_CLIENT_ID}:${process.env.SCHWAB_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SCHWAB_REDIRECT_URI!,
    }),
  });

  if (!res.ok) throw new Error(`Schwab token exchange failed: ${await res.text()}`);
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
  const credentials = Buffer.from(
    `${process.env.SCHWAB_CLIENT_ID}:${process.env.SCHWAB_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(SCHWAB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error(`Schwab token refresh failed: ${await res.text()}`);
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

  if (!accountsRes.ok) throw new Error("Failed to fetch Schwab accounts");
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
      holdings.push({
        ticker: instr.symbol ?? "",
        company_name: instr.description ?? instr.symbol,
        shares: parseFloat(pos.longQuantity ?? pos.quantity ?? "0"),
        average_cost: parseFloat(pos.averagePrice ?? "0"),
        current_price: parseFloat(pos.marketValue ?? "0") / parseFloat(pos.longQuantity ?? "1"),
        previous_close: parseFloat(pos.previousCloseValue ?? "0"),
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
