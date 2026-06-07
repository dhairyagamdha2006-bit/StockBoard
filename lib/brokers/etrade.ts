import OAuth from "oauth";
import type { NormalizedHolding } from "./robinhood";
import { getBrokerOAuthEnv } from "@/lib/env";

const ETRADE_PROD = "https://api.etrade.com";
const ETRADE_SANDBOX = "https://apisb.etrade.com";
const BASE_URL = process.env.NODE_ENV !== "production" ? ETRADE_SANDBOX : ETRADE_PROD;

function getOAuth() {
  const { clientId, clientSecret, redirectUri } = getBrokerOAuthEnv("etrade");
  return new OAuth.OAuth(
    `${BASE_URL}/oauth/request_token`,
    `${BASE_URL}/oauth/access_token`,
    clientId,
    clientSecret,
    "1.0",
    redirectUri,
    "HMAC-SHA1"
  );
}

export async function getETradeRequestToken(): Promise<{
  oauthToken: string;
  oauthTokenSecret: string;
  authorizeUrl: string;
}> {
  const { clientId } = getBrokerOAuthEnv("etrade");
  const oauth = getOAuth();
  return new Promise((resolve, reject) => {
    oauth.getOAuthRequestToken((err, token, secret) => {
      if (err) return reject(new Error("E*TRADE request-token step failed."));
      const authorizeUrl = `https://us.etrade.com/e/t/etws/authorize?key=${clientId}&token=${token}`;
      resolve({ oauthToken: token, oauthTokenSecret: secret, authorizeUrl });
    });
  });
}

export async function getETradeAccessToken(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string
): Promise<{ accessToken: string; accessTokenSecret: string }> {
  const oauth = getOAuth();
  return new Promise((resolve, reject) => {
    oauth.getOAuthAccessToken(requestToken, requestTokenSecret, verifier, (err, token, secret) => {
      // Never surface the raw OAuth error — it can include response bodies.
      if (err) return reject(new Error("E*TRADE access-token exchange failed."));
      resolve({ accessToken: token, accessTokenSecret: secret });
    });
  });
}

export async function fetchETradeHoldings(
  accessToken: string,
  accessTokenSecret: string
): Promise<NormalizedHolding[]> {
  const oauth = getOAuth();

  const accountsData = await new Promise<string>((resolve, reject) => {
    oauth.get(
      `${BASE_URL}/v1/accounts/list.json`,
      accessToken,
      accessTokenSecret,
      (err, data) => {
        if (err) return reject(err);
        resolve(data as string);
      }
    );
  });

  const accounts = JSON.parse(accountsData);
  const accountList = accounts?.AccountListResponse?.Accounts?.Account ?? [];
  const holdings: NormalizedHolding[] = [];

  for (const account of accountList) {
    const accountIdKey = account.accountIdKey;
    const portfolioData = await new Promise<string>((resolve, reject) => {
      oauth.get(
        `${BASE_URL}/v1/accounts/${accountIdKey}/portfolio.json`,
        accessToken,
        accessTokenSecret,
        (err, data) => {
          if (err) return reject(err);
          resolve(data as string);
        }
      );
    });

    const portfolio = JSON.parse(portfolioData);
    const positions = portfolio?.PortfolioResponse?.AccountPortfolio?.[0]?.Position ?? [];

    for (const pos of positions) {
      const complete = pos.Complete ?? {};
      holdings.push({
        ticker: pos.symbolDescription ?? "",
        company_name: complete.companyName ?? pos.symbolDescription,
        shares: parseFloat(pos.quantity ?? "0"),
        average_cost: parseFloat(complete.costPerShare ?? "0"),
        current_price: parseFloat(pos.Quick?.lastTrade ?? "0"),
        previous_close: parseFloat(pos.Quick?.lastTrade ?? "0") - parseFloat(pos.Quick?.change ?? "0"),
        asset_type: pos.positionType === "OPTION" ? "option" : "stock",
      });
    }
  }

  return holdings;
}
