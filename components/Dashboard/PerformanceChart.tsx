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
import { LineChart as LineChartIcon, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/formatters";

type Range = "1W" | "1M" | "3M" | "1Y";

const RANGES: Range[] = ["1W", "1M", "3M", "1Y"];

interface ChartDataPoint {
  date: string; // formatted for display
  value: number;
}

interface HistoryResponse {
  points: { date: string; value: number }[];
  source: "current_holdings_market_history" | "empty";
  partial: boolean;
  missingTickers: string[];
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PerformanceChart() {
  const [range, setRange] = useState<Range>("1M");
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<"ok" | "empty" | "error">("ok");
  const [partial, setPartial] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      // Clear stale data immediately so an old range (or leftover demo curve)
      // never lingers while the new range loads.
      setLoading(true);
      setData([]);
      setPartial(false);
      setMissing([]);
      try {
        const res = await fetch(`/api/portfolio/history?range=${range}`);
        if (!active) return;
        if (!res.ok) {
          setState("error");
          return;
        }
        const body: HistoryResponse = await res.json();
        if (!active) return;
        if (body.source === "empty") {
          setState("empty");
          setData([]);
          return;
        }
        setPartial(body.partial);
        setMissing(body.missingTickers ?? []);
        setData(body.points.map((p) => ({ date: formatDate(p.date), value: p.value })));
        setState(body.points.length === 0 ? "error" : "ok");
      } catch {
        if (active) setState("error");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [range]);

  const minVal = data.length ? Math.min(...data.map((d) => d.value)) * 0.995 : 0;
  const maxVal = data.length ? Math.max(...data.map((d) => d.value)) * 1.005 : 100000;

  return (
    <Card className="animate-slide-up" style={{ animationDelay: "200ms" } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white">Portfolio Performance</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              aria-pressed={range === r}
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

      <p className="text-[11px] text-gray-400 font-sans mb-4">
        Based on your current holdings and historical market prices.
      </p>

      {partial && missing.length > 0 && (
        <div className="flex items-start gap-2 mb-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] font-sans text-amber-700 dark:text-amber-300">
            Historical prices weren&apos;t available for {missing.slice(0, 5).join(", ")}
            {missing.length > 5 ? ` +${missing.length - 5} more` : ""}. The chart reflects the
            remaining holdings.
          </p>
        </div>
      )}

      <div className="h-52">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : state === "empty" ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
            <LineChartIcon className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-sans font-medium text-gray-500 dark:text-gray-300">
              No holdings yet
            </p>
            <p className="text-xs text-gray-400 font-sans max-w-xs">
              Import a CSV or connect a broker to see how your portfolio would have moved over time.
            </p>
          </div>
        ) : state === "error" ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-6">
            <AlertTriangle className="w-7 h-7 text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-sans font-medium text-gray-500 dark:text-gray-300">
              Performance history is unavailable
            </p>
            <p className="text-xs text-gray-400 font-sans max-w-xs">
              Historical market prices couldn&apos;t be loaded right now. Check the Alpaca API keys,
              then try again.
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
                minTickGap={32}
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
