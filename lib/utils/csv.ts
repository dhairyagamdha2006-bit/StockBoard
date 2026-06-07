import Papa from "papaparse";

/**
 * Robust CSV generation via PapaParse — handles commas, quotes, and newlines in
 * values (e.g. company names like "Alphabet, Inc."), which naive join(",") does not.
 */

export interface HoldingCsvRow {
  ticker: string;
  company: string;
  broker: string;
  shares: number;
  averageCost: number;
  price: number;
  value: number;
  gainLoss: number;
  gainLossPct: number;
}

const HOLDING_HEADERS = [
  "Ticker",
  "Company",
  "Broker",
  "Shares",
  "Avg Cost",
  "Price",
  "Value",
  "P&L",
  "P&L %",
];

export function holdingsToCsv(rows: HoldingCsvRow[]): string {
  return Papa.unparse({
    fields: HOLDING_HEADERS,
    data: rows.map((r) => [
      r.ticker,
      r.company,
      r.broker,
      r.shares,
      r.averageCost,
      r.price,
      r.value,
      r.gainLoss,
      r.gainLossPct,
    ]),
  });
}

/** Triggers a browser download of `content` as a file. No-op on the server. */
export function downloadCsv(filename: string, content: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
