export const dynamic = "force-dynamic";
import Link from "next/link";
import { FileText, AlertTriangle } from "lucide-react";
import { RobinhoodForm } from "@/components/Connect/RobinhoodForm";
import { getBrokerAvailability } from "@/lib/brokers/availability";

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
          <p className="text-sm text-gray-400 mt-1">CSV import is the recommended way</p>
        </div>

        <div className="space-y-4">
          {/* CSV — recommended */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-6">
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-4 h-4 text-[#4ade80]" />
              <h2 className="text-sm font-semibold font-sans text-[#111] dark:text-white">Import CSV (recommended)</h2>
            </div>
            <p className="text-xs text-gray-500 font-sans mb-4">
              Robinhood has no public API, so CSV import is the safe, reliable option.
            </p>
            <Link
              href="/connect/robinhood/csv"
              className="block text-center w-full py-2.5 rounded-xl bg-[#4ade80] text-[#1a1a2e] text-sm font-sans font-medium hover:opacity-90 transition-opacity"
            >
              Import CSV now
            </Link>
          </div>

          {/* Experimental login — only when explicitly enabled */}
          {a.experimentalEnabled && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-semibold font-sans text-red-700 dark:text-red-300">
                    Experimental — use at your own risk
                  </span>
                </div>
                <p className="text-xs text-red-700/90 dark:text-red-300/90 font-sans leading-relaxed">
                  This uses an unofficial private endpoint with your username/password. It may break or
                  put your account at risk. Prefer CSV import above.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8">
                <RobinhoodForm />
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/dashboard" className="hover:text-gray-600 dark:hover:text-gray-200">← Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
