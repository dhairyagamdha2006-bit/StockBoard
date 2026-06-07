import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] font-sans">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto px-6 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1a1a2e] rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="9" width="2" height="6" rx="0.5" fill="#4ade80" />
              <rect x="5" y="5" width="2" height="10" rx="0.5" fill="#4ade80" />
              <rect x="9" y="2" width="2" height="13" rx="0.5" fill="#4ade80" />
              <rect x="13" y="6" width="2" height="9" rx="0.5" fill="#4ade80" />
              <polyline points="2,8 6,4 10,1 14,5" stroke="#4ade80" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-bold text-base">
            <span className="text-[#111] dark:text-white">Stock</span>
            <span className="text-[#4ade80]">Board</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-gray-500 hover:text-[#111] dark:hover:text-white transition-colors">
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 bg-[#4ade80] text-[#1a1a2e] text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-28 pb-20 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4ade80]/10 text-[#4ade80] text-xs font-mono font-medium mb-8">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ade80] opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#4ade80]" />
          </span>
          Prices refresh every 30s · Free to use
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-[#111] dark:text-white leading-tight mb-6">
          All your stocks.
          <br />
          <span className="text-[#4ade80]">One dashboard.</span>
        </h1>

        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
          StockBoard connects Robinhood, Fidelity, E*TRADE, and Charles Schwab into
          a single auto-updating portfolio view — so you always know where you stand.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-8 py-3.5 bg-[#4ade80] text-[#1a1a2e] font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            Get Started Free →
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 border border-black/[0.08] dark:border-white/[0.08] text-[#111] dark:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-sm font-medium"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: "📡",
              title: "Auto-Updating Prices",
              desc: "Quotes from Alpaca Markets refresh every 30 seconds during market hours, with instant Supabase Realtime pushes when the cache updates.",
            },
            {
              icon: "🏦",
              title: "4 Brokers, One View",
              desc: "Robinhood, Fidelity, E*TRADE, and Charles Schwab — all connected with secure OAuth or CSV import.",
            },
            {
              icon: "📊",
              title: "Full Analytics",
              desc: "Performance charts, sector breakdowns, top gainers/losers, and complete transaction history.",
            },
            {
              icon: "🔒",
              title: "Encrypted at Rest",
              desc: "Broker tokens are AES-256-GCM encrypted before they touch the database. The app refuses to start without a real encryption key.",
            },
            {
              icon: "⚡",
              title: "Daily Auto-Sync",
              desc: "A Vercel Cron job re-syncs every connected account once daily — and you can hit “Sync Now” for an instant refresh anytime.",
            },
            {
              icon: "🌙",
              title: "Dark Mode",
              desc: "Full dark mode support. Toggle between light and dark — your eyes will thank you.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-gray-900/60 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-sm text-[#111] dark:text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-[#1a1a2e] rounded-3xl p-10 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">Ready to unify your portfolio?</h2>
          <p className="text-gray-400 text-sm mb-7">Sign up free — no credit card required.</p>
          <Link
            href="/signup"
            className="px-8 py-3.5 bg-[#4ade80] text-[#1a1a2e] font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm inline-block"
          >
            Create Free Account →
          </Link>
        </div>
      </section>

      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] py-8 text-center text-xs text-gray-400 font-sans">
        © {new Date().getFullYear()} StockBoard. Built with Next.js & Supabase.
      </footer>
    </div>
  );
}
