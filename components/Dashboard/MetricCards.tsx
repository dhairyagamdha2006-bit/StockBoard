"use client";

import { Card } from "@/components/ui/Card";
import { clsx } from "clsx";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import type { PortfolioStats } from "@/types";

interface MetricCardsProps {
  stats: PortfolioStats;
  loading?: boolean;
}

export function MetricCards({ stats, loading }: MetricCardsProps) {
  const cards = [
    {
      label: "Day Gain / Loss",
      value: formatCurrency(stats.dayGain),
      sub: formatPercent(stats.dayGainPct),
      positive: stats.dayGain >= 0,
    },
    {
      label: "Total Invested",
      value: formatCurrency(stats.totalInvested),
      sub: `${stats.positionCount} positions`,
      positive: null,
    },
    {
      label: "Total Return",
      value: formatCurrency(stats.totalReturn),
      sub: formatPercent(stats.totalReturnPct),
      positive: stats.totalReturn >= 0,
    },
    {
      label: "Positions",
      value: String(stats.positionCount),
      sub: "holdings",
      positive: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <Card
          key={card.label}
          className={clsx(
            "animate-slide-up",
            loading && "opacity-50 animate-pulse"
          )}
          style={{ animationDelay: `${i * 80}ms` } as React.CSSProperties}
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 font-sans uppercase tracking-wide mb-1">
            {card.label}
          </p>
          <p
            className={clsx(
              "text-xl font-medium font-mono",
              card.positive === true && "text-[#4ade80]",
              card.positive === false && "text-[#f87171]",
              card.positive === null && "text-[#111] dark:text-white"
            )}
          >
            {card.value}
          </p>
          <p
            className={clsx(
              "text-xs font-mono mt-0.5",
              card.positive === true && "text-[#4ade80]",
              card.positive === false && "text-[#f87171]",
              card.positive === null && "text-gray-400"
            )}
          >
            {card.sub}
          </p>
        </Card>
      ))}
    </div>
  );
}
