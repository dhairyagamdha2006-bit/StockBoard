export const dynamic = "force-dynamic";
import { BrokerCsvUpload } from "@/components/Connect/BrokerCsvUpload";
import Link from "next/link";

export default function RobinhoodCsvPage() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold font-mono mx-auto mb-4" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
            RH
          </div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Import Robinhood CSV</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            Robinhood has no official export, so use a simple CSV with these columns.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8">
          <div className="mb-6 p-4 bg-[#fee2e2]/40 rounded-xl text-xs font-mono text-[#dc2626] leading-relaxed overflow-x-auto">
            Symbol,Shares,Average Cost,Price<br />
            AAPL,10,165.20,212.45<br />
            NVDA,25,78.40,131.60
          </div>
          <BrokerCsvUpload broker="robinhood" exportHint="Columns: Symbol, Shares, Average Cost, Price" />
        </div>
        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/connect/robinhood" className="hover:text-gray-600 dark:hover:text-gray-200">← Back to Robinhood options</Link>
        </p>
      </div>
    </div>
  );
}
