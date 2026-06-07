"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#1a1a2e] rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="9" width="2" height="6" rx="0.5" fill="#4ade80" />
                <rect x="5" y="5" width="2" height="10" rx="0.5" fill="#4ade80" />
                <rect x="9" y="2" width="2" height="13" rx="0.5" fill="#4ade80" />
                <rect x="13" y="6" width="2" height="9" rx="0.5" fill="#4ade80" />
              </svg>
            </div>
            <span className="font-bold text-base">
              <span className="text-[#111] dark:text-white">Stock</span>
              <span className="text-[#4ade80]">Board</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Welcome back</h1>
          <p className="text-sm text-gray-400 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#fafafa] dark:bg-gray-800 text-sm text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#fafafa] dark:bg-gray-800 text-sm text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-xs text-[#f87171]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#4ade80] text-[#1a1a2e] font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#4ade80] hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
