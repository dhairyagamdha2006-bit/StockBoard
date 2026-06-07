export const dynamic = "force-dynamic";
import { RobinhoodForm } from "@/components/Connect/RobinhoodForm";
import Link from "next/link";

export default function ConnectRobinhoodPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold font-mono mx-auto mb-4" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
            RH
          </div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Connect Robinhood</h1>
          <p className="text-sm text-gray-400 mt-1">Link your Robinhood account to sync holdings</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8">
          <RobinhoodForm />
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/dashboard" className="hover:text-gray-600 dark:hover:text-gray-200">← Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
