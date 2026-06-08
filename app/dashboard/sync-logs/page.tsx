"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BROKER_CONFIGS } from "@/types";
import type { BrokerName } from "@/types";
import { clsx } from "clsx";

interface SyncLog {
  id: string;
  broker_name: string;
  status: "success" | "failed" | "skipped" | string;
  message?: string | null;
  error_message?: string | null;
  holdings_synced?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  skipped: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function formatDateTime(s?: string | null): string {
  if (!s) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(s));
}

function duration(started?: string | null, finished?: string | null): string {
  if (!started || !finished) return "—";
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function SyncLogsPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerName | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setLogs((data as SyncLog[]) ?? []);
        setLoading(false);
      });
  }, [supabase]);

  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (broker !== "all" && l.broker_name !== broker) return false;
        if (status !== "all" && l.status !== status) return false;
        return true;
      }),
    [logs, broker, status]
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#111] dark:text-white font-sans">Sync Logs</h1>
        <p className="text-sm text-gray-400 mt-0.5">{filtered.length} entries</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <select
          aria-label="Filter by broker"
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
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 text-sm rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.05] dark:border-white/[0.05]">
                {["Broker", "Status", "Message", "Started", "Duration"].map((c) => (
                  <th key={c} className="px-5 py-3.5 text-left text-xs font-medium font-sans text-gray-400 uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-black/[0.04]">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : filtered.map((l) => {
                    const cfg = BROKER_CONFIGS[l.broker_name as BrokerName];
                    return (
                      <tr key={l.id} className="border-b border-black/[0.04] dark:border-white/[0.04] last:border-0">
                        <td className="px-5 py-4">
                          {cfg ? (
                            <span className="px-2 py-0.5 rounded-md text-xs font-sans font-medium" style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}>{cfg.displayName}</span>
                          ) : (
                            <span className="text-xs text-gray-500">{l.broker_name}</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={clsx("px-2 py-0.5 rounded-md text-xs font-sans font-medium capitalize", STATUS_STYLES[l.status] ?? STATUS_STYLES.skipped)}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-sans text-xs text-gray-600 dark:text-gray-300 max-w-[320px] truncate" title={l.message ?? l.error_message ?? ""}>
                          {l.message ?? l.error_message ?? "—"}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-500">{formatDateTime(l.started_at ?? l.created_at)}</td>
                        <td className="px-5 py-4 font-mono text-xs text-gray-500">{duration(l.started_at, l.finished_at)}</td>
                      </tr>
                    );
                  })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400 font-sans">
                    No sync activity yet. Sync a broker or import a CSV to see logs here.
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
