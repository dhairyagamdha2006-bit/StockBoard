"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle } from "lucide-react";
import { clsx } from "clsx";
import type { NormalizedHolding } from "@/lib/brokers/robinhood";
import { formatCurrency } from "@/lib/utils/formatters";

export function FidelityUpload() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<NormalizedHolding[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadForPreview(f: File) {
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("preview", "true");

    const res = await fetch("/api/import/fidelity", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);

    if (!res.ok || data.error) {
      setError(data.error ?? "Failed to parse CSV");
      return;
    }

    setPreview(data.holdings);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) {
      setFile(f);
      uploadForPreview(f);
    } else {
      setError("Please upload a .csv file");
    }
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      uploadForPreview(f);
    }
  }

  async function handleConfirm() {
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/import/fidelity", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);

    if (!res.ok || data.error) {
      setError(data.error);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="space-y-6">
      {!preview ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={clsx(
            "border-2 border-dashed rounded-2xl p-12 text-center transition-colors",
            dragging
              ? "border-[#4ade80] bg-[#4ade80]/5"
              : "border-black/[0.12] dark:border-white/[0.12] hover:border-[#4ade80]/50"
          )}
        >
          <Upload className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-sm font-sans text-gray-600 dark:text-gray-400 mb-1">
            Drop your Fidelity CSV here
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Export from Fidelity: Accounts → Positions → Download CSV
          </p>
          <label className="cursor-pointer px-4 py-2 bg-[#4ade80]/10 text-[#4ade80] text-sm font-sans font-medium rounded-lg hover:bg-[#4ade80]/20 transition-colors">
            Browse file
            <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
          </label>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-[#4ade80]" />
            <span className="text-sm font-sans text-[#111] dark:text-white font-medium">{file?.name}</span>
            <span className="text-xs text-gray-400">{preview.length} positions found</span>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.08] dark:border-white/[0.08] overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/[0.05] dark:border-white/[0.05]">
                  {["Ticker", "Company", "Shares", "Avg Cost", "Price", "Value"].map((col) => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-sans font-medium text-gray-400 uppercase tracking-wide">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 8).map((h, i) => (
                  <tr key={i} className="border-b border-black/[0.04] last:border-0">
                    <td className="px-4 py-2.5 font-mono font-medium text-[#111] dark:text-white">{h.ticker}</td>
                    <td className="px-4 py-2.5 font-sans text-gray-500 max-w-[150px] truncate">{h.company_name}</td>
                    <td className="px-4 py-2.5 font-mono text-[#111] dark:text-white">{h.shares}</td>
                    <td className="px-4 py-2.5 font-mono text-[#111] dark:text-white">{formatCurrency(h.average_cost)}</td>
                    <td className="px-4 py-2.5 font-mono text-[#111] dark:text-white">{formatCurrency(h.current_price)}</td>
                    <td className="px-4 py-2.5 font-mono text-[#111] dark:text-white">{formatCurrency(h.shares * h.current_price)}</td>
                  </tr>
                ))}
                {preview.length > 8 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-center text-gray-400 font-sans">
                      +{preview.length - 8} more positions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="flex-1 py-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] text-sm font-sans text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-[#4ade80] text-[#1a1a2e] text-sm font-sans font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? "Importing…" : "Confirm Import"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-[#f87171] font-sans">{error}</p>}
    </div>
  );
}
