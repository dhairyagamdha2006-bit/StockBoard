import type { AlpacaSnapshot } from "@/types";

const ALPACA_DATA_BASE = "https://data.alpaca.markets/v2";
const WS_URL = "wss://stream.data.alpaca.markets/v2/iex";

const AUTH_HEADERS = {
  "APCA-API-KEY-ID": process.env.ALPACA_API_KEY ?? "",
  "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY ?? "",
};

export async function getSnapshots(
  tickers: string[]
): Promise<Map<string, AlpacaSnapshot>> {
  if (tickers.length === 0) return new Map();

  const params = new URLSearchParams({ symbols: tickers.join(",") });
  const res = await fetch(`${ALPACA_DATA_BASE}/stocks/snapshots?${params}`, {
    headers: AUTH_HEADERS,
  });

  if (!res.ok) {
    console.error("Alpaca snapshots failed:", await res.text());
    return new Map();
  }

  const data: Record<string, AlpacaSnapshot> = await res.json();
  return new Map(Object.entries(data));
}

export async function getLatestBars(tickers: string[]): Promise<Map<string, { price: number; prevClose: number; change: number; changePct: number }>> {
  const snapshots = await getSnapshots(tickers);
  const result = new Map<string, { price: number; prevClose: number; change: number; changePct: number }>();

  for (const [symbol, snap] of Array.from(snapshots)) {
    const price = snap.latestTrade?.p ?? snap.minuteBar?.c ?? 0;
    const prevClose = snap.prevDailyBar?.c ?? 0;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    result.set(symbol, { price, prevClose, change, changePct });
  }

  return result;
}

export function createAlpacaWebSocket(
  tickers: string[],
  onUpdate: (symbol: string, price: number) => void
): WebSocket {
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: "auth",
      key: process.env.ALPACA_API_KEY,
      secret: process.env.ALPACA_SECRET_KEY,
    }));
  };

  ws.onmessage = (event) => {
    try {
      const messages = JSON.parse(event.data as string);
      for (const msg of messages) {
        if (msg.T === "authenticated") {
          ws.send(JSON.stringify({ action: "subscribe", trades: tickers }));
        } else if (msg.T === "t" && msg.S && msg.p) {
          onUpdate(msg.S, msg.p);
        }
      }
    } catch (e) {
      console.error("WS parse error:", e);
    }
  };

  return ws;
}
