"use client";

import { useEffect, useState, useCallback } from "react";
import { ExternalLink, CheckCircle, RefreshCw, AlertTriangle, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BROKER_CONFIGS } from "@/types";
import type { BrokerAccount, BrokerName } from "@/types";
import { timeAgo } from "@/lib/utils/formatters";

const BROKERS: BrokerName[] = ["robinhood", "fidelity", "etrade", "schwab"];

// Where "Re-upload CSV" should link per broker.
const CSV_HREF: Record<BrokerName, string> = {
  fidelity: "/connect/fidelity",
  schwab: "/connect/schwab/csv",
  etrade: "/connect/etrade/csv",
  robinhood: "/connect/robinhood/csv",
};

interface LastLog {
  status: string;
  message?: string | null;
  created_at: string;
}

function connectionLabel(type?: string | null): string {
  if (type === "csv") return "CSV import";
  if (type === "oauth") return "OAuth";
  if (type === "credentials") return "Experimental";
  return "Connected";
}

export function ConnectedAccounts({ onChanged }: { onChanged?: () => void }) {
  const [accounts, setAccounts] = useState<Record<string, BrokerAccount>>({});
  const [lastLogs, setLastLogs] = useState<Record<string, LastLog>>({});
  const [busy, setBusy] = useState<Record<string, "sync" | "disconnect" | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const refreshAccounts = useCallback(async () => {
    const { data } = await supabase.from("broker_accounts").select("*");
    const map: Record<string, BrokerAccount> = {};
    for (const a of data ?? []) map[a.broker_name] = a;
    setAccounts(map);

    // Best-effort: latest sync log per broker (table may be empty on new DBs).
    const { data: logs } = await supabase
      .from("sync_logs")
      .select("broker_name, status, message, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    const logMap: Record<string, LastLog> = {};
    for (const l of logs ?? []) {
      if (!logMap[l.broker_name]) logMap[l.broker_name] = l as LastLog;
    }
    setLastLogs(logMap);
  }, [supabase]);

  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  async function handleSync(broker: BrokerName) {
    setBusy((b) => ({ ...b, [broker]: "sync" }));
    setError(null);
    try {
      const res = await fetch(`/api/sync/${broker}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed to sync ${BROKER_CONFIGS[broker].displayName}`);
      }
      await refreshAccounts();
      onChanged?.();
    } finally {
      setBusy((b) => ({ ...b, [broker]: undefined }));
    }
  }

  async function handleDisconnect(broker: BrokerName) {
    if (!confirm(`Disconnect ${BROKER_CONFIGS[broker].displayName}? This removes its holdings.`)) return;
    setBusy((b) => ({ ...b, [broker]: "disconnect" }));
    setError(null);
    try {
      const res = await fetch("/api/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to disconnect");
      }
      await refreshAccounts();
      onChanged?.();
    } finally {
      setBusy((b) => ({ ...b, [broker]: undefined }));
    }
  }

  return (
    <div className="animate-slide-up" style={{ animationDelay: "400ms" } as React.CSSProperties}>
      <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white mb-4">Connected Accounts</h2>
      {error && <p role="alert" className="text-xs text-[#f87171] font-sans mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BROKERS.map((broker) => {
          const cfg = BROKER_CONFIGS[broker];
          const account = accounts[broker];
          const isConnected = !!account && account.status === "active";
          const isErrored = !!account && account.status === "error";
          const isCsv = account?.connection_type === "csv";
          const isBusy = busy[broker];
          const lastLog = lastLogs[broker];

          return (
            <div key={broker} className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-5">
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono"
                  style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}
                >
                  {cfg.initials}
                </div>
                {isConnected && <CheckCircle className="w-4 h-4 text-[#4ade80]" aria-label="Connected" />}
                {isErrored && <AlertTriangle className="w-4 h-4 text-amber-500" aria-label="Sync error" />}
              </div>

              <p className="font-sans font-semibold text-sm text-[#111] dark:text-white mb-0.5">{cfg.displayName}</p>

              {isConnected || isErrored ? (
                <p className="text-[10px] uppercase tracking-wide font-sans text-gray-400 mb-1">
                  {connectionLabel(account.connection_type)}
                </p>
              ) : null}

              <p className="text-xs text-gray-400 font-sans mb-3 min-h-[1rem]">
                {isErrored
                  ? "Sync error — reconnect"
                  : isCsv
                    ? `Last imported ${timeAgo(account.last_synced_at)}`
                    : isConnected
                      ? `Synced ${timeAgo(account.last_synced_at)}`
                      : "Not connected"}
              </p>

              {(isConnected || isErrored) && lastLog && (
                <p className="text-[11px] font-sans text-gray-400 mb-3 truncate" title={lastLog.message ?? lastLog.status}>
                  Last: <span className={lastLog.status === "failed" ? "text-[#f87171]" : "text-gray-500 dark:text-gray-300"}>{lastLog.status}</span>
                </p>
              )}

              {isConnected && isCsv ? (
                <div className="space-y-2">
                  <a
                    href={CSV_HREF[broker]}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-medium font-sans bg-[#4ade80]/10 text-[#4ade80] hover:bg-[#4ade80]/20 transition-colors"
                  >
                    <Upload className="w-3 h-3" /> Re-upload CSV
                  </a>
                  <p className="text-[10px] text-gray-400 font-sans text-center">CSV accounts update by re-uploading.</p>
                  <button
                    onClick={() => handleDisconnect(broker)}
                    disabled={!!isBusy}
                    aria-label={`Disconnect ${cfg.displayName}`}
                    className="w-full py-2 rounded-xl text-xs font-medium font-sans border border-black/[0.08] dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {isBusy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : isConnected ? (
                <div className="space-y-2">
                  <button
                    onClick={() => handleSync(broker)}
                    disabled={!!isBusy}
                    aria-label={`Sync ${cfg.displayName} now`}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-medium font-sans bg-[#4ade80]/10 text-[#4ade80] hover:bg-[#4ade80]/20 transition-colors disabled:opacity-50"
                  >
                    {isBusy === "sync" ? (<><RefreshCw className="w-3 h-3 animate-spin" /> Syncing…</>) : "Sync Now"}
                  </button>
                  <button
                    onClick={() => handleDisconnect(broker)}
                    disabled={!!isBusy}
                    aria-label={`Disconnect ${cfg.displayName}`}
                    className="w-full py-2 rounded-xl text-xs font-medium font-sans border border-black/[0.08] dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {isBusy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <a
                  href={`/connect/${broker}`}
                  className="flex items-center justify-center gap-1 w-full py-2 rounded-xl text-xs font-medium font-sans border border-black/[0.08] dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {isErrored ? "Reconnect" : "Connect"} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
