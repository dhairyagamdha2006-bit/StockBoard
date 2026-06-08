"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Holdings", href: "/dashboard/holdings" },
  { label: "Market", href: "/dashboard/market" },
  { label: "Analytics", href: "/dashboard/analytics" },
  { label: "History", href: "/dashboard/history" },
  { label: "Sync Logs", href: "/dashboard/sync-logs" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-black/[0.08] dark:border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1a1a2e] rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="9" width="2" height="6" rx="0.5" fill="#4ade80" />
              <rect x="5" y="5" width="2" height="10" rx="0.5" fill="#4ade80" />
              <rect x="9" y="2" width="2" height="13" rx="0.5" fill="#4ade80" />
              <rect x="13" y="6" width="2" height="9" rx="0.5" fill="#4ade80" />
              <polyline points="2,8 6,4 10,1 14,5" stroke="#4ade80" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-sans font-bold text-base">
            <span className="text-[#111] dark:text-white">Stock</span>
            <span className="text-[#4ade80]">Board</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium font-sans transition-colors",
                  active
                    ? "bg-[#4ade80]/10 text-[#4ade80]"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Avatar / sign out */}
        <button
          onClick={handleSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4ade80] to-[#22d3ee] flex items-center justify-center text-white font-bold text-sm font-sans hover:opacity-80 transition-opacity"
        >
          S
        </button>
      </div>

      {/* Mobile nav — horizontally scrollable */}
      <nav
        aria-label="Primary"
        className="md:hidden border-t border-black/[0.06] dark:border-white/[0.06] px-3 py-2 flex items-center gap-1 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-medium font-sans whitespace-nowrap transition-colors",
                active
                  ? "bg-[#4ade80]/10 text-[#4ade80]"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
