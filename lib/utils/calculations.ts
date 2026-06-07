import type { Holding, PortfolioStats } from "@/types";

export function calculatePortfolioStats(holdings: Holding[]): PortfolioStats {
  let totalValue = 0;
  let totalInvested = 0;
  let dayGain = 0;

  for (const h of holdings) {
    const value = h.market_value ?? (h.current_price ?? 0) * h.shares;
    const invested = (h.average_cost ?? 0) * h.shares;
    totalValue += value;
    totalInvested += invested;
    dayGain += h.day_change ?? 0;
  }

  const totalReturn = totalValue - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const dayGainPct = totalValue > 0 ? (dayGain / (totalValue - dayGain)) * 100 : 0;

  return {
    totalValue,
    totalInvested,
    totalReturn,
    totalReturnPct,
    dayGain,
    dayGainPct,
    positionCount: holdings.length,
  };
}

export function groupByBroker(holdings: Holding[]): Map<string, Holding[]> {
  const map = new Map<string, Holding[]>();
  for (const h of holdings) {
    const broker = h.broker_accounts?.broker_name ?? "unknown";
    const existing = map.get(broker) ?? [];
    existing.push(h);
    map.set(broker, existing);
  }
  return map;
}

export function isMarketOpen(): boolean {
  const now = new Date();
  const et = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    weekday: "long",
    hour12: false,
  }).formatToParts(now);
  const weekday = et.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(et.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parseInt(et.find((p) => p.type === "minute")?.value ?? "0");
  const totalMinutes = hour * 60 + minute;
  const isWeekday = !["Saturday", "Sunday"].includes(weekday);
  return isWeekday && totalMinutes >= 570 && totalMinutes < 960; // 9:30 AM - 4:00 PM ET
}
