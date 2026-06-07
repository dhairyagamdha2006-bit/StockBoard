"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { BROKER_CONFIGS } from "@/types";
import type { Transaction, BrokerName } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";
import { clsx } from "clsx";

const TYPE_STYLES: Record<string, string> = {
  buy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  sell: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  dividend: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  split: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerName | "all">("all");
  const [type, setType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("transactions")
      .select("*, broker_accounts(broker_name)")
      .order("transaction_date", { ascending: false })
      .then(({ data }) => {
        setTransactions((data as Transaction[]) ?? []);
        setLoading(false);
      });
  }, [supabase]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (broker !== "all" && t.broker_accounts?.broker_name !== broker) return false;
      if (type !== "all" && t.transaction_type !== type) return false;
      if (dateFrom && t.transaction_date < dateFrom) return false;
      if (dateTo && t.transaction_date > dateTo + "T23:59:59") return false;
      return true;
    });
  }, [transactions, broker, type, dateFrom, dateTo]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#111] dark:text-white font-sans">Transaction History</h1>
        <p className="text-sm text-gray-400 mt-0.5">{filtered.length} transactions</p>
      </div>

      {/* Honest disclosure: transaction sync is not yet implemented. */}
      <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-xs font-sans text-amber-800 dark:text-amber-300">
        <strong>Read-only view.</strong> StockBoard does not yet import transaction
        records from brokers — only current holdings are synced. This page shows any
        transactions present in your database (e.g. seeded by future imports) and will
        stay empty until transaction import is added.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={broker}
          onChange={(e) => setBroker(e.target.value as BrokerName | "all")}
          className="px-4 py-2 text-sm rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
        >
          <option value="all">All Brokers</option>
          {(["robinhood", "fidelity", "etrade", "schwab"] as BrokerName[]).map((b) => (
            <option key={b} value={b}>{BROKER_CONFIGS[b].displayName}</option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-4 py-2 text-sm rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
        >
          <option value="all">All Types</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
          <option value="dividend">Dividend</option>
          <option value="split">Split</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-4 py-2 text-sm rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
        />
        <span className="flex items-center text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-4 py-2 text-sm rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.05] dark:border-white/[0.05]">
                {["Date", "Type", "Ticker", "Broker", "Shares", "Price", "Total"].map((col) => (
                  <th key={col} className="px-5 py-3.5 text-left text-xs font-medium font-sans text-gray-400 uppercase tracking-wide">{col}</th>
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
                : filtered.map((t) => {
                    const broker = t.broker_accounts?.broker_name ?? "robinhood";
                    const cfg = BROKER_CONFIGS[broker as BrokerName] ?? BROKER_CONFIGS.robinhood;
                    return (
                      <tr key={t.id} className="border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-gray-500">{formatDate(t.transaction_date)}</td>
                        <td className="px-5 py-4">
                          <span className={clsx("px-2 py-0.5 rounded-md text-xs font-sans font-medium capitalize", TYPE_STYLES[t.transaction_type] ?? TYPE_STYLES.buy)}>
                            {t.transaction_type}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono font-medium text-[#111] dark:text-white">{t.ticker}</td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded-md text-xs font-sans font-medium" style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}>{cfg.displayName}</span>
                        </td>
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">{t.shares ?? "—"}</td>
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">{t.price ? formatCurrency(t.price) : "—"}</td>
                        <td className="px-5 py-4 font-mono text-sm text-[#111] dark:text-white">{t.total_amount ? formatCurrency(t.total_amount) : "—"}</td>
                      </tr>
                    );
                  })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400 font-sans">
                    No transactions to display. Transaction import isn&apos;t implemented yet —
                    see the note above.
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
