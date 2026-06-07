"use client";

import { useEffect, useState } from "react";
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
  const { holdings, stats, brokerBreakdown, loading, lastUpdate, sync } = usePortfolioStats();
  const [demoBusy, setDemoBusy] = useState(false);
  const hasHoldings = holdings.length > 0;

  async function loadDemo() {
    setDemoBusy(true);
    try {
      await fetch("/api/demo", { method: "POST" });
      window.location.reload();
    } catch {
      setDemoBusy(false);
    }
  }

  async function clearDemo() {
    setDemoBusy(true);
    try {
      await fetch("/api/demo", { method: "DELETE" });
      window.location.reload();
    } catch {
      setDemoBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero Value Row */}
      <div className="animate-fade-in flex items-end justify-between">
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
        <div className="flex items-center gap-3">
          <SyncIndicator lastUpdate={lastUpdate} />
          <button
            onClick={hasHoldings ? clearDemo : loadDemo}
            disabled={demoBusy}
            className="px-3 py-1.5 text-xs font-sans font-medium rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            title={hasHoldings ? "Remove demo holdings" : "Load sample holdings to explore the app"}
          >
            {demoBusy ? "Working…" : hasHoldings ? "Clear Demo Data" : "Load Demo Data"}
          </button>
          <button
            onClick={sync}
            className="px-3 py-1.5 text-xs font-sans font-medium rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Sync Now
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <MetricCards stats={stats} loading={loading} />

      {/* Chart + Broker split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <PerformanceChart />
        </div>
        <div>
          <BrokerBreakdown brokers={brokerBreakdown} />
        </div>
      </div>

      {/* Holdings Table */}
      <HoldingsTable holdings={holdings} loading={loading} />

      {/* Connected Accounts */}
      <ConnectedAccounts />
    </div>
  );
}
