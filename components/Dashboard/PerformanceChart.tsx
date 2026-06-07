"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { LineChart as LineChartIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/formatters";
import type { PortfolioSnapshot } from "@/types";

type Range = "1W" | "1M" | "3M" | "1Y";

const RANGES: Range[] = ["1W", "1M", "3M", "1Y"];

function getDaysBack(range: Range): number {
  return { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 }[range];
}

interface ChartDataPoint {
  date: string;
  value: number;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-black/[0.08] dark:border-white/[0.08] rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 font-sans">{label}</p>
      <p className="text-sm font-mono font-medium text-[#111] dark:text-white">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export function PerformanceChart() {
  const [range, setRange] = useState<Range>("1M");
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - getDaysBack(range));

      const { data: snapshots } = await supabase
        .from("portfolio_snapshots")
        .select("total_value, snapshot_date")
        .gte("snapshot_date", since.toISOString().split("T")[0])
        .order("snapshot_date", { ascending: true });

      // Honest data only: we plot real portfolio snapshots. If none exist yet,
      // we show an empty state rather than fabricating a random trend line.
      setData(
        (snapshots ?? []).map((s) => ({
          date: new Date((s as PortfolioSnapshot).snapshot_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          value: (s as PortfolioSnapshot).total_value,
        }))
      );
      setLoading(false);
    }
    load();
  }, [range]);

  const minVal = data.length ? Math.min(...data.map((d) => d.value)) * 0.995 : 0;
  const maxVal = data.length ? Math.max(...data.map((d) => d.value)) * 1.005 : 100000;

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "200ms" } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white">Portfolio Performance</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                range === r
                  ? "bg-[#4ade80]/10 text-[#4ade80]"
                  : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-52">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
            <LineChartIcon className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-sans font-medium text-gray-500 dark:text-gray-300">
              No performance history yet
            </p>
            <p className="text-xs text-gray-400 font-sans max-w-xs">
              Your portfolio value is captured once per day after a sync. The chart fills in as
              snapshots accumulate.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#888" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minVal, maxVal]}
                tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#888" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#4ade80"
                strokeWidth={2}
                fill="url(#greenGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#4ade80", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
