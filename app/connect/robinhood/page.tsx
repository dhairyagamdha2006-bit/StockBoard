export const dynamic = "force-dynamic";
import { RobinhoodForm } from "@/components/Connect/RobinhoodForm";
import { BrokerUnavailable } from "@/components/Connect/BrokerUnavailable";
import { getBrokerAvailability } from "@/lib/brokers/availability";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function ConnectRobinhoodPage() {
  const a = getBrokerAvailability("robinhood");

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold font-mono mx-auto mb-4" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
            RH
          </div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Connect Robinhood</h1>
          <p className="text-sm text-gray-400 mt-1">Experimental integration</p>
        </div>

        {a.available ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-xs font-semibold font-sans text-red-700 dark:text-red-300">
                  Experimental — use at your own risk
                </span>
              </div>
              <p className="text-xs text-red-700/90 dark:text-red-300/90 font-sans leading-relaxed">
                Robinhood has no public API. This uses an unofficial private endpoint with your
                username/password to obtain a token. It may break, trigger security challenges, or
                put your account at risk. Do not use this with an account you care about — prefer a
                supported broker or demo mode.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8">
              <RobinhoodForm />
            </div>
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
