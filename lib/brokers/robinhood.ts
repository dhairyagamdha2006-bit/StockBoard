const RH_BASE = "https://api.robinhood.com";

interface RHTokenResponse {
  access_token?: string;
  mfa_required?: boolean;
  mfa_type?: string;
  detail?: string;
}

interface RHPosition {
  instrument: string;
  quantity: string;
  average_buy_price: string;
  intraday_quantity: string;
}

interface RHInstrument {
  symbol: string;
  name: string;
  type: string;
}

interface RHQuote {
  last_trade_price: string;
  last_extended_hours_trade_price?: string;
  adjusted_previous_close: string;
}

export interface NormalizedHolding {
  ticker: string;
  company_name: string;
  shares: number;
  average_cost: number;
  current_price: number;
  previous_close: number;
  asset_type: string;
}

const DEVICE_TOKEN = "76306f60-e6c4-4c49-8b22-5440a9c0a5b6";

export async function robinhoodLogin(
  username: string,
  password: string,
  mfaCode?: string
): Promise<{ token?: string; mfaRequired?: boolean; error?: string }> {
  const body: Record<string, string> = {
    client_id: "c82SH0WZOsabOXGP2sxqcj34FxkvfnWRZBKlBjFS",
    expires_in: "86400",
    grant_type: "password",
    password,
    scope: "internal",
    username,
    device_token: DEVICE_TOKEN,
  };

  if (mfaCode) {
    body.mfa_code = mfaCode;
  }

  const res = await fetch(`${RH_BASE}/oauth2/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data: RHTokenResponse = await res.json();

  if (data.mfa_required) return { mfaRequired: true };
  if (!data.access_token) return { error: data.detail ?? "Login failed" };
  return { token: data.access_token };
}

export async function fetchRobinhoodHoldings(accessToken: string): Promise<NormalizedHolding[]> {
  const posRes = await fetch(`${RH_BASE}/positions/?nonzero=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!posRes.ok) throw new Error("Failed to fetch Robinhood positions");

  const posData = await posRes.json();
  const positions: RHPosition[] = posData.results ?? [];

  const holdings: NormalizedHolding[] = [];

  for (const pos of positions) {
    if (parseFloat(pos.quantity) <= 0) continue;

    const instrRes = await fetch(pos.instrument, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const instr: RHInstrument = await instrRes.json();

    const quoteRes = await fetch(`${RH_BASE}/quotes/${instr.symbol}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const quote: RHQuote = await quoteRes.json();

    const currentPrice =
      parseFloat(quote.last_extended_hours_trade_price ?? "0") ||
      parseFloat(quote.last_trade_price);
    const previousClose = parseFloat(quote.adjusted_previous_close);

    holdings.push({
      ticker: instr.symbol,
      company_name: instr.name,
      shares: parseFloat(pos.quantity),
      average_cost: parseFloat(pos.average_buy_price),
      current_price: currentPrice,
      previous_close: previousClose,
      asset_type: instr.type === "cryptocurrency" ? "crypto" : "stock",
    });
  }

  return holdings;
}
