export const dynamic = "force-dynamic";
import { OAuthButton } from "@/components/Connect/OAuthButton";
import { BrokerUnavailable } from "@/components/Connect/BrokerUnavailable";
import { getBrokerAvailability } from "@/lib/brokers/availability";
import Link from "next/link";

export default function ConnectETradePage() {
  const a = getBrokerAvailability("etrade");

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold font-mono mx-auto mb-4" style={{ backgroundColor: "#ffedd5", color: "#c2410c" }}>
            ET
          </div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Connect E*TRADE</h1>
          <p className="text-sm text-gray-400 mt-1">Authorize read-only access to your account</p>
        </div>

        {a.available ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8 space-y-4">
            <div className="text-xs text-gray-500 font-sans space-y-1.5">
              <p>✓ Read-only access — we cannot trade</p>
              <p>✓ OAuth 1.0a — your login stays on E*TRADE</p>
              <p>✓ Token stored encrypted with AES-256-GCM</p>
            </div>
            <OAuthButton broker="etrade" label="E*TRADE" color="#c2410c" />
          </div>
        ) : (
          <BrokerUnavailable
            displayName={a.displayName}
            reason={a.unavailableReason ?? a.summary}
            requirements={a.requirements}
          />
        )}

        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/dashboard" className="hover:text-gray-600 dark:hover:text-gray-200">← Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
