"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const oauthToken = params.get("oauth_token") ?? "";
    const verifier = params.get("oauth_verifier") ?? "";

    if (!verifier) {
      setStatus("error");
      setErrorMsg("Missing OAuth verifier. Please try again.");
      return;
    }

    // Callback query params MUST be encoded — E*TRADE's oauth_token/oauth_verifier
    // contain characters (=, +, /) that would corrupt the query string otherwise.
    fetch(
      `/api/connect/etrade?action=callback&oauth_token=${encodeURIComponent(oauthToken)}&oauth_verifier=${encodeURIComponent(verifier)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setTimeout(() => {
            fetch("/api/sync/etrade", { method: "POST" }).finally(() => {
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
          <div className="w-10 h-10 border-2 border-[#c2410c] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-sans text-gray-600 dark:text-gray-400">Completing E*TRADE connection…</p>
        </>
      )}
      {status === "success" && (
        <>
          <div className="w-12 h-12 bg-[#4ade80]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#4ade80]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-sans text-[#111] dark:text-white font-medium">E*TRADE connected!</p>
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
          <button onClick={() => router.push("/connect/etrade")} className="mt-4 text-xs text-[#4ade80] hover:underline">
            Try again
          </button>
        </>
      )}
    </div>
  );
}

export default function ETradeCallbackPage() {
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
