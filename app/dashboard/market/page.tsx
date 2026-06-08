"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, Star, X, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils/formatters";
import { clsx } from "clsx";

interface AssetResult {
  symbol: string;
  name: string;
}
interface WatchItem {
  symbol: string;
  name: string;
}
interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
}

export default function MarketPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      const items: WatchItem[] = data.items ?? [];
      setWatchlist(items);
      // Fetch quotes (best-effort; the row still renders if a quote fails).
      const entries = await Promise.all(
        items.map(async (it) => {
          try {
            const r = await fetch(`/api/market/quote?symbol=${encodeURIComponent(it.symbol)}`);
            if (!r.ok) return null;
            const d = await r.json();
            return [it.symbol, d.quote] as const;
          } catch {
            return null;
          }
        })
      );
      const qmap: Record<string, Quote> = {};
      for (const e of entries) if (e) qmap[e[0]] = e[1];
      setQuotes(qmap);
    } finally {
      setLoadingWatchlist(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  // Debounced search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  const inWatchlist = (symbol: string) => watchlist.some((w) => w.symbol === symbol);

  async function addToWatchlist(item: AssetResult) {
    setWatchlist((w) => (inWatchlist(item.symbol) ? w : [{ symbol: item.symbol, name: item.name }, ...w]));
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    loadWatchlist();
  }

  async function removeFromWatchlist(symbol: string) {
    setWatchlist((w) => w.filter((it) => it.symbol !== symbol));
    await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-xl font-bold text-[#111] dark:text-white font-sans">Market</h1>
        <p className="text-sm text-gray-400 mt-0.5">Search stocks and track a watchlist</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by ticker or company (e.g. AAPL, Apple)…"
          aria-label="Search stocks"
          className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-[#111] dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
        />
        {(results.length > 0 || searching) && (
          <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-900 rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-lg overflow-hidden max-h-80 overflow-y-auto">
            {searching && results.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400 font-sans">Searching…</p>
            ) : (
              results.map((r) => (
                <div key={r.symbol} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Link href={`/dashboard/market/${r.symbol}`} className="flex-1 min-w-0">
                    <span className="font-mono font-medium text-sm text-[#111] dark:text-white">{r.symbol}</span>
                    <span className="ml-2 text-xs text-gray-400 truncate">{r.name}</span>
                  </Link>
                  <button
                    onClick={() => addToWatchlist(r)}
                    aria-label={`Add ${r.symbol} to watchlist`}
                    className={clsx("ml-3 shrink-0", inWatchlist(r.symbol) ? "text-[#facc15]" : "text-gray-300 hover:text-[#facc15]")}
                  >
                    <Star className="w-4 h-4" fill={inWatchlist(r.symbol) ? "currentColor" : "none"} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Watchlist */}
      <div>
        <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white mb-4">Your Watchlist</h2>
        {loadingWatchlist ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/[0.12] dark:border-white/[0.12] p-10 text-center">
            <Star className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm font-sans text-gray-500 dark:text-gray-300">Your watchlist is empty</p>
            <p className="text-xs text-gray-400 font-sans mt-1">Search above and tap the star to track a stock.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((it) => {
              const q = quotes[it.symbol];
              const pos = (q?.change ?? 0) >= 0;
              return (
                <div key={it.symbol} className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-5">
                  <div className="flex items-start justify-between mb-2">
                    <Link href={`/dashboard/market/${it.symbol}`}>
                      <p className="font-mono font-semibold text-[#111] dark:text-white">{it.symbol}</p>
                      <p className="text-xs text-gray-400 font-sans truncate max-w-[160px]">{it.name}</p>
                    </Link>
                    <button onClick={() => removeFromWatchlist(it.symbol)} aria-label={`Remove ${it.symbol}`} className="text-gray-300 hover:text-[#f87171]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {q ? (
                    <div className="flex items-end justify-between">
                      <span className="font-mono text-lg text-[#111] dark:text-white">{formatCurrency(q.price)}</span>
                      <span className={clsx("flex items-center gap-1 text-xs font-mono", pos ? "text-[#4ade80]" : "text-[#f87171]")}>
                        {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatPercent(q.changePct)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 font-sans">Quote unavailable</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
