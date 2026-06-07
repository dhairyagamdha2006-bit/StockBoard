"use client";

import { useState, useMemo } from "react";
import { Download } from "lucide-react";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import { BROKER_CONFIGS } from "@/types";
import type { BrokerName } from "@/types";
import { formatCurrency, formatPercent, formatShares } from "@/lib/utils/formatters";
import { clsx } from "clsx";

const BROKERS: BrokerName[] = ["robinhood", "fidelity", "etrade", "schwab"];
type SortKey = "ticker" | "shares" | "average_cost" | "current_price" | "market_value" | "total_gain_loss";
type SortDir = "asc" | "desc";

export default function HoldingsPage() {
  const { holdings, loading } = usePortfolioStats();
  const [search, setSearch] = useState("");
  const [brokerFilter, setBrokerFilter] = useState<BrokerName | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("market_value");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const filtered = useMemo(() => {
    let list = holdings;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) =>
          h.ticker.toLowerCase().includes(q) ||
          (h.company_name ?? "").toLowerCase().includes(q)
      );
    }
    if (brokerFilter !== "all") {
      list = list.filter((h) => h.broker_accounts?.broker_name === brokerFilter);
    }
    return [...list].sort((a, b) => {
      const av = (a[sortKey] ?? 0) as string | number;
      const bv = (b[sortKey] ?? 0) as string | number;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av);
      const bn = Number(bv);
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [holdings, search, brokerFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function exportCSV() {
    const header = "Ticker,Company,Broker,Shares,Avg Cost,Price,Value,P&L,P&L %";
    const rows = filtered.map((h) =>
      [
        h.ticker,
        h.company_name ?? "",
        h.broker_accounts?.broker_name ?? "",
        h.shares,
        h.average_cost ?? 0,
        h.current_price ?? 0,
        h.market_value ?? 0,
        h.total_gain_loss ?? 0,
        h.total_gain_loss_pct ?? 0,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stockboard-holdings.csv";
    a.click();
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#111] dark:text-white font-sans">Holdings</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} positions</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-black/[0.08] dark:border-white/[0.08] text-sm font-sans text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search ticker or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 text-sm rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-[#111] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30 w-56"
        />
        <div className="flex gap-2">
          {(["all", ...BROKERS] as const).map((b) => {
            const cfg = b === "all" ? null : BROKER_CONFIGS[b];
            return (
              <button
                key={b}
                onClick={() => setBrokerFilter(b as BrokerName | "all")}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-colors",
                  brokerFilter === b
                    ? "bg-[#4ade80]/10 text-[#4ade80]"
                    : "bg-white dark:bg-gray-900 border border-black/[0.08] dark:border-white/[0.08] text-gray-600 dark:text-gray-400 hover:border-[#4ade80]/30"
                )}
              >
                {b === "all" ? "All Brokers" : cfg?.displayName}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.05] dark:border-white/[0.05]">
                {[
                  { label: "Asset", key: "ticker" as SortKey },
                  { label: "Broker", key: null },
                  { label: "Shares", key: "shares" as SortKey },
                  { label: "Avg Cost", key: "average_cost" as SortKey },
                  { label: "Price", key: "current_price" as SortKey },
                  { label: "Value", key: "market_value" as SortKey },
                  { label: "P&L", key: "total_gain_loss" as SortKey },
                ].map(({ label, key }) => (
                  <th
                    key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    className={clsx(
                      "px-5 py-3.5 text-left text-xs font-medium font-sans text-gray-400 uppercase tracking-wide",
                      key && "cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                    )}
                  >
                    {label}{key && <SortIcon k={key} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-black/[0.04]">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((h) => {
                    const broker = h.broker_accounts?.broker_name ?? "robinhood";
                    const cfg = BROKER_CONFIGS[broker] ?? BROKER_CONFIGS.robinhood;
                    const pnl = h.total_gain_loss ?? 0;
                    const pnlPct = h.total_gain_loss_pct ?? 0;
                    const pos = pnl >= 0;
                    return (
                      <tr key={h.id} className="border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold font-mono" style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}>
                              {h.ticker.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-mono font-medium text-[#111] dark:text-white">{h.ticker}</p>
                              <p className="text-xs text-gray-400 font-sans">{h.company_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded-md text-xs font-sans font-medium" style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}>{cfg.displayName}</span>
                        </td>
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">{formatShares(h.shares)}</td>
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">{formatCurrency(h.average_cost ?? 0)}</td>
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">{formatCurrency(h.current_price ?? 0)}</td>
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">{formatCurrency(h.market_value ?? 0)}</td>
                        <td className="px-5 py-4">
                          <p className={clsx("font-mono text-sm", pos ? "text-[#4ade80]" : "text-[#f87171]")}>
                            {pos ? "+" : ""}{formatCurrency(pnl)}
                          </p>
                          <p className={clsx("font-mono text-xs", pos ? "text-[#4ade80]" : "text-[#f87171]")}>
                            {formatPercent(pnlPct)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
