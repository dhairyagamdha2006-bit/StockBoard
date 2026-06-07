"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { clsx } from "clsx";
import { formatCurrency, formatPercent, formatShares } from "@/lib/utils/formatters";
import { BROKER_CONFIGS } from "@/types";
import type { Holding } from "@/types";

interface HoldingsTableProps {
  holdings: Holding[];
  loading?: boolean;
}

function MiniSparkline({ positive }: { positive: boolean }) {
  const bars = [3, 5, 4, 7, 6, 8, positive ? 9 : 5];
  return (
    <span className="inline-flex items-end gap-px h-4">
      {bars.map((h, i) => (
        <span
          key={i}
          className={clsx("w-0.5 rounded-sm", positive ? "bg-[#4ade80]" : "bg-[#f87171]")}
          style={{ height: `${(h / 10) * 100}%` }}
        />
      ))}
    </span>
  );
}

export function HoldingsTable({ holdings, loading }: HoldingsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return holdings;
    return holdings.filter(
      (h) =>
        h.ticker.toLowerCase().includes(q) ||
        (h.company_name ?? "").toLowerCase().includes(q) ||
        (h.broker_accounts?.broker_name ?? "").toLowerCase().includes(q)
    );
  }, [holdings, search]);

  return (
    <div className="animate-slide-up" style={{ animationDelay: "320ms" } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white">Holdings</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search holdings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs font-sans rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-[#111] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30 w-48"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.05] dark:border-white/[0.05]">
                {["Asset", "Source", "Shares", "Avg Cost", "Price", "Value / P&L"].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3.5 text-left text-xs font-medium font-sans text-gray-400 uppercase tracking-wide"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-black/[0.04] dark:border-white/[0.04]">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((holding) => {
                    const broker = holding.broker_accounts?.broker_name ?? "robinhood";
                    const cfg = BROKER_CONFIGS[broker] ?? BROKER_CONFIGS.robinhood;
                    const pnl = holding.total_gain_loss ?? 0;
                    const pnlPct = holding.total_gain_loss_pct ?? 0;
                    const positive = pnl >= 0;
                    const price = holding.current_price ?? 0;

                    return (
                      <tr
                        key={holding.id}
                        className="border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-default"
                      >
                        {/* Asset */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold font-mono flex-shrink-0"
                              style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}
                            >
                              {holding.ticker.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-mono font-medium text-[#111] dark:text-white text-sm">{holding.ticker}</p>
                              <p className="text-xs text-gray-400 font-sans truncate max-w-[120px]">{holding.company_name}</p>
                            </div>
                          </div>
                        </td>

                        {/* Source */}
                        <td className="px-5 py-4">
                          <span
                            className="px-2 py-0.5 rounded-md text-xs font-sans font-medium"
                            style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}
                          >
                            {cfg.displayName}
                          </span>
                        </td>

                        {/* Shares */}
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">
                          {formatShares(holding.shares)}
                        </td>

                        {/* Avg Cost */}
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">
                          {formatCurrency(holding.average_cost ?? 0)}
                        </td>

                        {/* Price + sparkline */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-[#111] dark:text-white">{formatCurrency(price)}</span>
                            <MiniSparkline positive={positive} />
                          </div>
                        </td>

                        {/* Value / P&L */}
                        <td className="px-5 py-4">
                          <p className="font-mono text-sm text-[#111] dark:text-white">
                            {formatCurrency(holding.market_value ?? 0)}
                          </p>
                          <p className={clsx("font-mono text-xs", positive ? "text-[#4ade80]" : "text-[#f87171]")}>
                            {positive ? "+" : ""}{formatCurrency(pnl)} ({formatPercent(pnlPct)})
                          </p>
                        </td>
                      </tr>
                    );
                  })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400 font-sans">
                    {search ? "No holdings match your search." : "No holdings yet. Connect a broker to get started."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
