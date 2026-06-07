"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/formatters";
import { BROKER_CONFIGS } from "@/types";
import type { BrokerBreakdownItem } from "@/types";

interface BrokerBreakdownProps {
  brokers: BrokerBreakdownItem[];
}

export function BrokerBreakdown({ brokers }: BrokerBreakdownProps) {
  const allBrokers = (["robinhood", "fidelity", "etrade", "schwab"] as const).map((name) => {
    const found = brokers.find((b) => b.broker === name);
    return found ?? { broker: name, value: 0, percentage: 0, isConnected: false, lastSynced: null };
  });

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "240ms" } as React.CSSProperties}>
      <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white mb-4">By Broker</h2>

      <div className="space-y-3 mb-5">
        {allBrokers.map((item) => {
          const cfg = BROKER_CONFIGS[item.broker];
          return (
            <div key={item.broker} className="flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: cfg.dotColor }}
              />
              <span className="flex-1 text-sm font-sans text-[#111] dark:text-white">{cfg.displayName}</span>
              {item.isConnected && <Badge variant="live">live</Badge>}
              <span className="font-mono text-sm text-[#111] dark:text-white">
                {item.isConnected ? formatCurrency(item.value) : "—"}
              </span>
              <span className="font-mono text-xs text-gray-400 w-12 text-right">
                {item.isConnected ? `${item.percentage.toFixed(1)}%` : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stacked allocation bar */}
      <div className="h-2 rounded-full flex overflow-hidden gap-0.5">
        {allBrokers
          .filter((b) => b.percentage > 0)
          .map((item) => {
            const cfg = BROKER_CONFIGS[item.broker];
            return (
              <div
                key={item.broker}
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: cfg.dotColor,
                  opacity: 0.8,
                }}
                title={`${cfg.displayName}: ${item.percentage.toFixed(1)}%`}
              />
            );
          })}
        {brokers.length === 0 && (
          <div className="h-full w-full bg-gray-100 dark:bg-gray-800 rounded-full" />
        )}
      </div>
    </Card>
  );
}
