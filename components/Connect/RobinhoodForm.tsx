"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

export function RobinhoodForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [needMfa, setNeedMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/connect/robinhood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, mfaCode: needMfa ? mfaCode : undefined }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.mfaRequired) {
      setNeedMfa(true);
      return;
    }

    if (!res.ok || data.error) {
      setError(data.error ?? "Login failed");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!needMfa ? (
        <>
          <div>
            <label className="block text-xs font-medium font-sans text-gray-600 dark:text-gray-400 mb-1.5">
              Email / Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-sm font-sans text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium font-sans text-gray-600 dark:text-gray-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-sm font-sans text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30"
              placeholder="••••••••"
            />
          </div>
        </>
      ) : (
        <div>
          <label className="block text-xs font-medium font-sans text-gray-600 dark:text-gray-400 mb-1.5">
            MFA Code
          </label>
          <input
            type="text"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            required
            autoFocus
            className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-gray-900 text-sm font-mono text-[#111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]/30 tracking-widest"
            placeholder="000000"
            maxLength={6}
          />
          <p className="mt-1.5 text-xs text-gray-400 font-sans">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-[#f87171] font-sans">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className={clsx(
          "w-full py-3 rounded-xl font-medium font-sans text-sm transition-opacity",
          "bg-[#4ade80] text-[#1a1a2e]",
          loading && "opacity-60 cursor-not-allowed"
        )}
      >
        {loading ? "Connecting…" : needMfa ? "Verify Code" : "Connect Robinhood"}
      </button>

      <p className="text-xs text-gray-400 font-sans text-center">
        Your credentials are used once to obtain a session token and are never stored.
      </p>
    </form>
  );
}
