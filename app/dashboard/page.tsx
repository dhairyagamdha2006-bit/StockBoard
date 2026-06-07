"use client";

import { useEffect, useState, useCallback } from "react";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import { MetricCards } from "@/components/Dashboard/MetricCards";
import { PerformanceChart } from "@/components/Dashboard/PerformanceChart";
import { BrokerBreakdown } from "@/components/Dashboard/BrokerBreakdown";
import { HoldingsTable } from "@/components/Dashboard/HoldingsTable";
import { ConnectedAccounts } from "@/components/Dashboard/ConnectedAccounts";
import { PriceFlicker } from "@/components/ui/PriceFlicker";
import { Badge } from "@/components/ui/Badge";
import { formatPercent, formatCurrency } from "@/lib/utils/formatters";

function SyncIndicator({ lastUpdate }: { lastUpdate: Date | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!lastUpdate) return;
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-gray-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4ade80]" />
      </span>
      Live · {lastUpdate ? (elapsed === 0 ? "just now" : `${elapsed}s ago`) : "connecting…"}
    </div>
  );
}

export default function DashboardPage() {
  const { holdings, stats, brokerBreakdown, loading, lastUpdate, refetch, sync } = usePortfolioStats();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshDemoStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/demo");
      if (res.ok) setDemoActive((await res.json()).active === true);
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    refreshDemoStatus();
  }, [refreshDemoStatus]);

  async function loadDemo() {
    setDemoBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load demo data");
      await Promise.all([refetch(), refreshDemoStatus()]);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to load demo data");
    } finally {
      setDemoBusy(false);
    }
  }

  async function clearDemo() {
    setDemoBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/demo", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to clear demo data");
      await Promise.all([refetch(), refreshDemoStatus()]);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to clear demo data");
    } finally {
      setDemoBusy(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setActionError(null);
    try {
      await sync();
      setRefreshKey((k) => k + 1);
    } catch {
      setActionError("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Demo banner */}
      {demoActive && (
        <div
          role="status"
          className="flex items-center justify-between gap-4 rounded-xl border border-[#4ade80]/30 bg-[#4ade80]/10 px-4 py-3 animate-fade-in"
        >
          <p className="text-xs font-sans text-[#15803d] dark:text-[#4ade80]">
            <strong>Demo mode.</strong> You&apos;re viewing sample holdings — not real
            brokerage data. Clear it anytime to start fresh.
          </p>
          <button
            onClick={clearDemo}
            disabled={demoBusy}
            className="shrink-0 text-xs font-medium font-sans text-[#15803d] dark:text-[#4ade80] hover:underline disabled:opacity-50"
          >
            {demoBusy ? "Clearing…" : "Clear demo data"}
          </button>
        </div>
      )}

      {/* Hero Value Row */}
      <div className="animate-fade-in flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <PriceFlicker value={stats.totalValue} large />
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={stats.dayGain >= 0 ? "positive" : "negative"}>
              {stats.dayGain >= 0 ? "+" : ""}{formatCurrency(stats.dayGain)} today
            </Badge>
            <Badge variant={stats.totalReturn >= 0 ? "positive" : "negative"}>
              {formatPercent(stats.totalReturnPct)} all-time
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SyncIndicator lastUpdate={lastUpdate} />
          {!demoActive && (
            <button
              onClick={loadDemo}
              disabled={demoBusy}
              className="px-3 py-1.5 text-xs font-sans font-medium rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              title="Load sample holdings to explore the app"
            >
              {demoBusy ? "Loading…" : "Load Demo Data"}
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            aria-label="Sync all connected accounts now"
            className="px-3 py-1.5 text-xs font-sans font-medium rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-xs font-sans text-red-700 dark:text-red-300">
          {actionError}
        </div>
      )}

      {/* Metric Cards */}
      <MetricCards stats={stats} loading={loading} />

      {/* Chart + Broker split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <PerformanceChart key={`chart-${refreshKey}`} />
        </div>
        <div>
          <BrokerBreakdown brokers={brokerBreakdown} />
        </div>
      </div>

      {/* Holdings Table */}
      <HoldingsTable holdings={holdings} loading={loading} />

      {/* Connected Accounts */}
      <ConnectedAccounts key={`accounts-${refreshKey}`} onChanged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
