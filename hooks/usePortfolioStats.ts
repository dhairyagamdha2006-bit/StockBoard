"use client";

import { useMemo } from "react";
import { useHoldings } from "./useHoldings";
import { useLivePrices } from "./useLivePrices";
import { calculatePortfolioStats, groupByBroker } from "@/lib/utils/calculations";
import type { BrokerBreakdownItem, BrokerName } from "@/types";

export function usePortfolioStats() {
  const { holdings, loading, error, refetch, sync } = useHoldings();
  const tickers = useMemo(() => Array.from(new Set(holdings.map((h) => h.ticker))), [holdings]);
  const { prices, lastUpdate } = useLivePrices(tickers);

  const enrichedHoldings = useMemo(() => {
    return holdings.map((h) => {
      const live = prices.get(h.ticker);
      if (!live) return h;
      const currentPrice = live.current_price ?? h.current_price ?? 0;
      const marketValue = currentPrice * h.shares;
      const dayChange = (live.day_change ?? 0) * h.shares;
      const invested = (h.average_cost ?? 0) * h.shares;
      return {
        ...h,
        current_price: currentPrice,
        market_value: marketValue,
        day_change: dayChange,
        day_change_pct: live.day_change_pct ?? h.day_change_pct,
        total_gain_loss: marketValue - invested,
        total_gain_loss_pct: invested > 0 ? ((marketValue - invested) / invested) * 100 : 0,
      };
    });
  }, [holdings, prices]);

  const stats = useMemo(() => calculatePortfolioStats(enrichedHoldings), [enrichedHoldings]);

  const brokerBreakdown = useMemo((): BrokerBreakdownItem[] => {
    const grouped = groupByBroker(enrichedHoldings);
    const total = stats.totalValue;
    return Array.from(grouped.entries()).map(([broker, items]) => {
      const value = items.reduce((s, h) => s + (h.market_value ?? 0), 0);
      return {
        broker: broker as BrokerName,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        isConnected: true,
        lastSynced: items[0]?.broker_accounts?.last_synced_at,
      };
    });
  }, [enrichedHoldings, stats.totalValue]);

  return { holdings: enrichedHoldings, stats, brokerBreakdown, loading, error, lastUpdate, refetch, sync };
}
