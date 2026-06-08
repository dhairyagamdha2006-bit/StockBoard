"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Star, ArrowLeft } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { clsx } from "clsx";

type Range = "1D" | "1W" | "1M" | "3M" | "1Y";
const RANGES: Range[] = ["1D", "1W", "1M", "3M", "1Y"];

interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
interface Bar {
  t: string;
  c: number;
}

export default function StockDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params.symbol ?? "").toUpperCase();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [range, setRange] = useState<Range>("1M");
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "ratelimited" | "error">("loading");
  const [inWatch, setInWatch] = useState(false);
  const [barsLoading, setBarsLoading] = useState(false);

  // Load quote + watchlist membership.
  useEffect(() => {
    let active = true;
    (async () => {
      setStatus("loading");
      try {
        const [qRes, wRes] = await Promise.all([
          fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`),
          fetch("/api/watchlist"),
        ]);
        if (!active) return;
        if (qRes.status === 404) return setStatus("notfound");
        if (qRes.status === 429) return setStatus("ratelimited");
        if (!qRes.ok) return setStatus("error");
        const qData = await qRes.json();
        setQuote(qData.quote);
        setStatus("ok");
        if (wRes.ok) {
          const wData = await wRes.json();
          setInWatch((wData.items ?? []).some((it: { symbol: string }) => it.symbol === symbol));
        }
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [symbol]);

  const loadBars = useCallback(async () => {
    setBarsLoading(true);
    try {
      const res = await fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}&range=${range}`);
      if (res.ok) {
        const data = await res.json();
        setBars(data.bars ?? []);
      } else {
        setBars([]);
      }
    } catch {
      setBars([]);
    } finally {
      setBarsLoading(false);
    }
  }, [symbol, range]);

  useEffect(() => {
    if (status === "ok") loadBars();
  }, [status, loadBars]);

  async function toggleWatch() {
    if (inWatch) {
      setInWatch(false);
      await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
    } else {
      setInWatch(true);
      await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, name: quote?.symbol ?? symbol }),
      });
    }
  }

  if (status === "loading") {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (status === "notfound" || status === "error" || status === "ratelimited") {
    const msg =
      status === "notfound"
        ? `No market data found for "${symbol}".`
        : status === "ratelimited"
          ? "You're requesting quotes too quickly. Please wait a moment."
          : "Market data is temporarily unavailable.";
    return (
      <div className="animate-fade-in">
        <Link href="/dashboard/market" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-6"><ArrowLeft className="w-4 h-4" /> Back to Market</Link>
        <div className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-12 text-center">
          <p className="text-sm font-sans text-gray-500 dark:text-gray-300">{msg}</p>
        </div>
      </div>
    );
  }

  const pos = (quote?.change ?? 0) >= 0;

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/dashboard/market" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /> Back to Market</Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white font-mono">{symbol}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono text-xl text-[#111] dark:text-white">{formatCurrency(quote!.price)}</span>
            <span className={clsx("font-mono text-sm", pos ? "text-[#4ade80]" : "text-[#f87171]")}>
              {pos ? "+" : ""}{formatCurrency(quote!.change)} ({formatPercent(quote!.changePct)})
            </span>
          </div>
        </div>
        <button
          onClick={toggleWatch}
          aria-label={inWatch ? "Remove from watchlist" : "Add to watchlist"}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-sans font-medium border transition-colors",
            inWatch
              ? "border-[#facc15]/40 text-[#facc15] bg-[#facc15]/10"
              : "border-black/[0.08] dark:border-white/[0.08] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          )}
        >
          <Star className="w-3.5 h-3.5" fill={inWatch ? "currentColor" : "none"} />
          {inWatch ? "Watching" : "Add to Watchlist"}
        </button>
      </div>

      {/* OHLC stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Open", value: quote!.open },
          { label: "High", value: quote!.high },
          { label: "Low", value: quote!.low },
          { label: "Prev Close", value: quote!.close },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-black/[0.08] dark:border-white/[0.08] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-sans">{s.label}</p>
            <p className="font-mono text-sm text-[#111] dark:text-white">{formatCurrency(s.value)}</p>
          </div>
        ))}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-black/[0.08] dark:border-white/[0.08] px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-sans">Volume</p>
          <p className="font-mono text-sm text-[#111] dark:text-white">{quote!.volume.toLocaleString()}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white">Price history</h2>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={clsx("px-3 py-1 rounded-lg text-xs font-mono transition-colors", range === r ? "bg-[#4ade80]/10 text-[#4ade80]" : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200")}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {barsLoading ? (
            <div className="h-full flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" /></div>
          ) : bars.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 font-sans">No chart data available for this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bars} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mktGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ade80" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#888" }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 12 }}
                  labelFormatter={(t) => new Date(t).toLocaleString()}
                  formatter={(v: number) => [formatCurrency(v), "Price"]}
                />
                <Area type="monotone" dataKey="c" stroke="#4ade80" strokeWidth={2} fill="url(#mktGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <p className="text-[11px] text-gray-400 font-sans mt-3">Data from Alpaca (IEX). May be delayed up to 15 minutes.</p>
      </div>
    </div>
  );
}
