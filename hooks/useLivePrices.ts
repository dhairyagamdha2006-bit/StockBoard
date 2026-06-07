"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PriceCache } from "@/types";

export function useLivePrices(tickers: string[]) {
  const [prices, setPrices] = useState<Map<string, PriceCache>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const supabase = createClient();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrices = useCallback(async (syms: string[]) => {
    if (syms.length === 0) return;
    try {
      const res = await fetch(`/api/prices?tickers=${syms.join(",")}`);
      if (!res.ok) return;
      const data: Record<string, { price: number; prevClose: number; change: number; changePct: number }> = await res.json();
      setPrices((prev) => {
        const next = new Map(prev);
        for (const [ticker, info] of Object.entries(data)) {
          next.set(ticker, {
            ticker,
            current_price: info.price,
            previous_close: info.prevClose,
            day_change: info.change,
            day_change_pct: info.changePct,
            updated_at: new Date().toISOString(),
          });
        }
        return next;
      });
      setLastUpdate(new Date());
    } catch (e) {
      console.error("Price fetch error:", e);
    }
  }, []);

  useEffect(() => {
    if (tickers.length === 0) return;

    fetchPrices(tickers);

    // Subscribe to Supabase Realtime for price cache changes
    const channel = supabase
      .channel("price-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "price_cache" },
        (payload) => {
          const row = payload.new as PriceCache;
          if (tickers.includes(row.ticker)) {
            setPrices((prev) => new Map(prev).set(row.ticker, row));
            setLastUpdate(new Date());
          }
        }
      )
      .subscribe();

    // Fallback polling every 30 seconds
    pollIntervalRef.current = setInterval(() => fetchPrices(tickers), 30_000);

    return () => {
      supabase.removeChannel(channel);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [tickers.join(","), fetchPrices, supabase]);

  return { prices, lastUpdate };
}
