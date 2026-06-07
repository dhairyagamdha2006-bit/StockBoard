import Papa from "papaparse";
import type { NormalizedHolding } from "./robinhood";

interface FidelityRow {
  Symbol?: string;
  Description?: string;
  Quantity?: string;
  "Average Cost Basis"?: string;
  "Last Price"?: string;
  "Current Value"?: string;
  "Today's Gain/Loss Dollar"?: string;
  "Total Gain/Loss Dollar"?: string;
  [key: string]: string | undefined;
}

export function parseFidelityCSV(
  csvContent: string
): NormalizedHolding[] {
  const { data } = Papa.parse<FidelityRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  });

  const holdings: NormalizedHolding[] = [];

  for (const row of data) {
    const symbol = row["Symbol"] ?? "";
    if (!symbol || symbol.startsWith("**") || symbol === "Symbol") continue;

    const shares = parseFloat((row["Quantity"] ?? "0").replace(/,/g, ""));
    if (isNaN(shares) || shares <= 0) continue;

    const avgCost = parseFloat((row["Average Cost Basis"] ?? "0").replace(/[$,]/g, ""));
    const lastPrice = parseFloat((row["Last Price"] ?? "0").replace(/[$,]/g, ""));
    const currentValue = parseFloat((row["Current Value"] ?? "0").replace(/[$,]/g, ""));
    const dayChange = parseFloat((row["Today's Gain/Loss Dollar"] ?? "0").replace(/[$,]/g, ""));

    holdings.push({
      ticker: symbol,
      company_name: row["Description"] ?? symbol,
      shares,
      average_cost: isNaN(avgCost) ? lastPrice : avgCost,
      current_price: isNaN(lastPrice) ? currentValue / shares : lastPrice,
      previous_close: isNaN(lastPrice) ? 0 : lastPrice - (isNaN(dayChange) ? 0 : dayChange / shares),
      asset_type: symbol.length > 5 ? "option" : "stock",
    });
  }

  return holdings;
}
