"use client";

import { useEffect, useState } from "react";
import { ExternalLink, CheckCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BROKER_CONFIGS } from "@/types";
import type { BrokerAccount, BrokerName } from "@/types";
import { timeAgo } from "@/lib/utils/formatters";

const BROKERS: BrokerName[] = ["robinhood", "fidelity", "etrade", "schwab"];

export function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<Record<string, BrokerAccount>>({});
  const [busy, setBusy] = useState<Record<string, "sync" | "disconnect" | undefined>>({});
  const supabase = createClient();

  async function refresh() {
    const { data } = await supabase.from("broker_accounts").select("*");
    if (!data) return;
    const map: Record<string, BrokerAccount> = {};
    for (const a of data) map[a.broker_name] = a;
    setAccounts(map);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getConnectHref(broker: BrokerName): string {
    return `/connect/${broker}`;
  }

  async function handleSync(broker: BrokerName) {
    setBusy((b) => ({ ...b, [broker]: "sync" }));
    try {
      await fetch(`/api/sync/${broker}`, { method: "POST" });
      await refresh();
    } finally {
      setBusy((b) => ({ ...b, [broker]: undefined }));
    }
  }

  async function handleDisconnect(broker: BrokerName) {
    if (!confirm(`Disconnect ${BROKER_CONFIGS[broker].displayName}? This removes its holdings.`)) {
      return;
    }
    setBusy((b) => ({ ...b, [broker]: "disconnect" }));
    try {
      await fetch("/api/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker }),
      });
      await refresh();
    } finally {
      setBusy((b) => ({ ...b, [broker]: undefined }));
    }
  }

  return (
    <div className="animate-slide-up" style={{ animationDelay: "400ms" } as React.CSSProperties}>
      <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white mb-4">Connected Accounts</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BROKERS.map((broker) => {
          const cfg = BROKER_CONFIGS[broker];
          const account = accounts[broker];
          const isConnected = !!account && account.status === "active";
          const isErrored = !!account && account.status === "error";
          const isBusy = busy[broker];

          return (
            <div
              key={broker}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono"
                  style={{ backgroundColor: cfg.bgColor, color: cfg.textColor }}
                >
                  {cfg.initials}
                </div>
                {isConnected && <CheckCircle className="w-4 h-4 text-[#4ade80]" />}
                {isErrored && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              </div>

              <p className="font-sans font-semibold text-sm text-[#111] dark:text-white mb-0.5">{cfg.displayName}</p>
              <p className="text-xs text-gray-400 font-sans mb-4">
                {isErrored
                  ? "Sync error — reconnect"
                  : isConnected
                    ? `Synced ${timeAgo(account.last_synced_at)}`
                    : "Not connected"}
              </p>

              {isConnected ? (
                <div className="space-y-2">
                  <button
                    onClick={() => handleSync(broker)}
                    disabled={!!isBusy}
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-medium font-sans bg-[#4ade80]/10 text-[#4ade80] hover:bg-[#4ade80]/20 transition-colors disabled:opacity-50"
                  >
                    {isBusy === "sync" ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" /> Syncing…
                      </>
                    ) : (
                      "Sync Now"
                    )}
                  </button>
                  <button
                    onClick={() => handleDisconnect(broker)}
                    disabled={!!isBusy}
                    className="w-full py-2 rounded-xl text-xs font-medium font-sans border border-black/[0.08] dark:border-white/[0.08] text-gray-500 dark:text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {isBusy === "disconnect" ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <a
                  href={getConnectHref(broker)}
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
