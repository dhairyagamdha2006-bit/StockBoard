export const dynamic = "force-dynamic";
import Link from "next/link";
import { FileText, ShieldCheck, Lock } from "lucide-react";
import { OAuthButton } from "@/components/Connect/OAuthButton";
import { getBrokerAvailability } from "@/lib/brokers/availability";

export default function ConnectETradePage() {
  const a = getBrokerAvailability("etrade");

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold font-mono mx-auto mb-4" style={{ backgroundColor: "#ffedd5", color: "#c2410c" }}>
            ET
          </div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Connect E*TRADE</h1>
          <p className="text-sm text-gray-400 mt-1">Pick how you&apos;d like to connect</p>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6">
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-4 h-4 text-[#4ade80]" />
              <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white">Import CSV (recommended)</h2>
            </div>
            <p className="text-xs text-gray-500 font-sans mb-4">Works immediately — no developer keys or approval needed.</p>
            <Link
              href="/connect/etrade/csv"
              className="block text-center w-full py-2.5 rounded-xl bg-[#4ade80] text-[#1a1a2e] text-sm font-sans font-medium hover:opacity-90 transition-opacity"
            >
              Import CSV now
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-[#c2410c]" />
              <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white">Connect with OAuth</h2>
            </div>
            {a.oauthConfigured ? (
              <>
                <p className="text-xs text-gray-500 font-sans mb-4">Official E*TRADE API, read-only access.</p>
                <OAuthButton broker="etrade" label="E*TRADE" color="#c2410c" />
              </>
            ) : (
              <p className="text-xs text-gray-400 font-sans flex items-start gap-1.5">
                <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                OAuth isn&apos;t configured on this deployment. It requires E*TRADE developer keys. Use CSV import above.
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/dashboard" className="hover:text-gray-600 dark:hover:text-gray-200">← Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
