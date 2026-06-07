export const dynamic = "force-dynamic";
import { FidelityUpload } from "@/components/Connect/FidelityUpload";
import Link from "next/link";

export default function ConnectFidelityPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold font-mono mx-auto mb-4" style={{ backgroundColor: "#dbeafe", color: "#1d4ed8" }}>
            FI
          </div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Connect Fidelity</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
            Upload your Fidelity positions CSV to import your holdings.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8">
          <div className="mb-6 p-4 bg-[#dbeafe]/40 rounded-xl text-xs font-sans text-[#1d4ed8] leading-relaxed">
            <strong>How to export:</strong> Log in to Fidelity → Accounts & Trade → Portfolio → Positions → Download (CSV button, top right).
          </div>
          <FidelityUpload />
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/dashboard" className="hover:text-gray-600 dark:hover:text-gray-200">← Back to dashboard</Link>
        </p>
      </div>
    </div>
  );
}
