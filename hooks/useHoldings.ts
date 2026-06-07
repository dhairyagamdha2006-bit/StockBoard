"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Holding } from "@/types";

export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchHoldings = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("holdings")
      .select("*, broker_accounts(broker_name, status, last_synced_at)")
      .order("market_value", { ascending: false });

    if (err) setError(err.message);
    else setHoldings((data as Holding[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  const sync = useCallback(async () => {
    await fetch("/api/sync/all", { method: "POST" });
    await fetchHoldings();
  }, [fetchHoldings]);

  return { holdings, loading, error, refetch: fetchHoldings, sync };
}
