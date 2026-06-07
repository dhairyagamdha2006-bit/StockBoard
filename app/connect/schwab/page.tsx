export const dynamic = "force-dynamic";
import { OAuthButton } from "@/components/Connect/OAuthButton";
import Link from "next/link";

export default function ConnectSchwabPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold font-mono mx-auto mb-4" style={{ backgroundColor: "#ede9fe", color: "#7c3aed" }}>
            CS
          </div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Connect Charles Schwab</h1>
          <p className="text-sm text-gray-400 mt-1">Authorize read-only access via Schwab&apos;s official API</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8 space-y-4">
          <div className="text-xs text-gray-500 font-sans space-y-1.5">
            <p>✓ Official Schwab Developer API (OAuth 2.0)</p>
            <p>✓ Read-only scope — we cannot trade</p>
            <p>✓ Token stored encrypted with AES-256</p>
            <p>✓ Auto-refreshes before expiry</p>
          </div>
          <OAuthButton broker="schwab" label="Charles Schwab" color="#7c3aed" />
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/dashboard" className="hover:text-gray-600 dark:hover:text-gray-200">← Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
