export const dynamic = "force-dynamic";
import { BrokerCsvUpload } from "@/components/Connect/BrokerCsvUpload";
import { BROKER_SUPPORT } from "@/lib/brokers/support";
import Link from "next/link";

export default function SchwabCsvPage() {
  const support = BROKER_SUPPORT.schwab;
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0f] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold font-mono mx-auto mb-4" style={{ backgroundColor: "#ede9fe", color: "#7c3aed" }}>
            CS
          </div>
          <h1 className="text-2xl font-bold text-[#111] dark:text-white">Import Schwab CSV</h1>
          <p className="text-sm text-gray-400 mt-1">{support.csvExportHint}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] p-8">
          <BrokerCsvUpload broker="schwab" exportHint={support.csvExportHint} />
        </div>
        <p className="text-center text-sm text-gray-400 mt-4">
          <Link href="/connect/schwab" className="hover:text-gray-600 dark:hover:text-gray-200">← Other Schwab options</Link>
        </p>
      </div>
    </div>
  );
}
