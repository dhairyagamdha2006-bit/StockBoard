"use client";

import { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Treemap,
} from "recharts";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { clsx } from "clsx";

const SECTOR_COLORS = [
  "#4ade80", "#22d3ee", "#a78bfa", "#fb923c", "#f472b6",
  "#facc15", "#34d399", "#60a5fa", "#f87171", "#c084fc",
];

const CustomPieTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-3 py-2 shadow-lg text-xs font-sans">
      <p className="font-medium text-[#111] dark:text-white">{payload[0].name}</p>
      <p className="text-gray-400">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export default function AnalyticsPage() {
  const { holdings, loading } = usePortfolioStats();

  const sectorData = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      const sector = h.sector ?? "Other";
      map.set(sector, (map.get(sector) ?? 0) + (h.market_value ?? 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  const gainers = useMemo(
    () =>
      [...holdings]
        .filter((h) => (h.total_gain_loss_pct ?? 0) > 0)
        .sort((a, b) => (b.total_gain_loss_pct ?? 0) - (a.total_gain_loss_pct ?? 0))
        .slice(0, 5),
    [holdings]
  );

  const losers = useMemo(
    () =>
      [...holdings]
        .filter((h) => (h.total_gain_loss_pct ?? 0) < 0)
        .sort((a, b) => (a.total_gain_loss_pct ?? 0) - (b.total_gain_loss_pct ?? 0))
        .slice(0, 5),
    [holdings]
  );

  const treemapData = useMemo(
    () => holdings.map((h) => ({ name: h.ticker, size: h.market_value ?? 0, pct: h.total_gain_loss_pct ?? 0 })),
    [holdings]
  );

  const TreemapCell = ({ x, y, width, height, name, pct }: { x?: number; y?: number; width?: number; height?: number; name?: string; pct?: number; root?: unknown }) => (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={(pct ?? 0) >= 0 ? "#4ade8033" : "#f8717133"} stroke="#fff" strokeWidth={2} rx={4} />
      {(width ?? 0) > 40 && (height ?? 0) > 24 && (
        <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) + (height ?? 0) / 2} textAnchor="middle" dominantBaseline="middle" className="font-mono" fontSize={11} fill={(pct ?? 0) >= 0 ? "#4ade80" : "#f87171"}>
          {name}
        </text>
      )}
    </g>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#111] dark:text-white font-sans">Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">Portfolio breakdown and performance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sector Pie */}
        <Card>
          <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white mb-4">Sector Breakdown</h2>
          <div className="h-52">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sectorData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sectorData} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={2}>
                    {sectorData.map((_, i) => (
                      <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-400 font-sans">
                No sector data yet
              </div>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {sectorData.slice(0, 5).map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SECTOR_COLORS[i] }} />
                <span className="font-sans text-gray-600 dark:text-gray-400 flex-1">{s.name}</span>
                <span className="font-mono text-[#111] dark:text-white">{formatCurrency(s.value)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Treemap */}
        <Card>
          <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white mb-4">Portfolio Allocation</h2>
          <div className="h-64">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : treemapData.length > 0 ? (
              <ResponsiveContainer>
                <Treemap data={treemapData} dataKey="size" content={<TreemapCell />} />
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-400 font-sans">
                No holdings to display
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Gainers */}
        <Card>
          <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white mb-4">Top Gainers</h2>
          <div className="space-y-3">
            {gainers.length > 0 ? gainers.map((h) => (
              <div key={h.id} className="flex items-center gap-3">
                <span className="font-mono font-medium text-sm text-[#111] dark:text-white w-16">{h.ticker}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                  <div className="bg-[#4ade80] h-1.5 rounded-full" style={{ width: `${Math.min(h.total_gain_loss_pct ?? 0, 100)}%` }} />
                </div>
                <span className="font-mono text-xs text-[#4ade80]">{formatPercent(h.total_gain_loss_pct ?? 0)}</span>
              </div>
            )) : (
              <p className="text-sm text-gray-400 font-sans">No gainers yet</p>
            )}
          </div>
        </Card>

        {/* Top Losers */}
        <Card>
          <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white mb-4">Top Losers</h2>
          <div className="space-y-3">
            {losers.length > 0 ? losers.map((h) => (
              <div key={h.id} className="flex items-center gap-3">
                <span className="font-mono font-medium text-sm text-[#111] dark:text-white w-16">{h.ticker}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                  <div className="bg-[#f87171] h-1.5 rounded-full" style={{ width: `${Math.min(Math.abs(h.total_gain_loss_pct ?? 0), 100)}%` }} />
                </div>
                <span className="font-mono text-xs text-[#f87171]">{formatPercent(h.total_gain_loss_pct ?? 0)}</span>
              </div>
            )) : (
              <p className="text-sm text-gray-400 font-sans">No losers yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
