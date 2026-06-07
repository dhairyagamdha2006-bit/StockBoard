"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-[#4ade80]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-[#4ade80]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[#111] dark:text-white mb-2">Check your email</h2>
          <p className="text-sm text-gray-400">
            We sent a confirmation link to <strong className="text-[#111] dark:text-white">{email}</strong>.
            Click it to activate your account.
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm text-[#4ade80] hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
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
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Create your account</h1>
          <p className="text-sm text-gray-400 mt-1">Free forever. No credit card required.</p>
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
                minLength={8}
                className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-[#fafafa] dark:bg-gray-800 text-sm text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
                placeholder="Min. 8 characters"
              />
            </div>

            {error && <p className="text-xs text-[#f87171]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#4ade80] text-[#1a1a2e] font-semibold text-sm rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#4ade80] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
