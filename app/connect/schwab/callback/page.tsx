"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (!code) {
      setStatus("error");
      setErrorMsg("Missing authorization code. Please try again.");
      return;
    }
    if (!state) {
      setStatus("error");
      setErrorMsg("Missing OAuth state. Please restart the connection.");
      return;
    }

    // Both query params MUST be URL-encoded — Schwab's code/state can contain
    // characters (=, /, +) that would otherwise corrupt the query string.
    fetch(
      `/api/connect/schwab?action=callback&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setTimeout(() => {
            fetch("/api/sync/schwab", { method: "POST" }).finally(() => {
              router.push("/dashboard");
            });
          }, 1500);
        } else {
          setStatus("error");
          setErrorMsg(data.error ?? "Connection failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Network error. Please try again.");
      });
  }, [params, router]);

  return (
    <div className="text-center">
      {status === "loading" && (
        <>
          <div className="w-10 h-10 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-sans text-gray-600 dark:text-gray-400">Completing Schwab connection…</p>
        </>
      )}
      {status === "success" && (
        <>
          <div className="w-12 h-12 bg-[#4ade80]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#4ade80]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-sans text-[#111] dark:text-white font-medium">Schwab connected!</p>
          <p className="text-xs text-gray-400 mt-1">Syncing your holdings…</p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#f87171]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm font-sans text-[#111] dark:text-white font-medium">Connection failed</p>
          <p className="text-xs text-[#f87171] mt-1">{errorMsg}</p>
          <button onClick={() => router.push("/connect/schwab")} className="mt-4 text-xs text-[#4ade80] hover:underline">
            Try again
          </button>
        </>
      )}
    </div>
  );
}

export default function SchwabCallbackPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-12">
        <Suspense fallback={<div className="w-8 h-8 border-2 border-[#4ade80] border-t-transparent rounded-full animate-spin" />}>
          <CallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}
