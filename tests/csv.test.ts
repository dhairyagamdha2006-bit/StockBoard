import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import { holdingsToCsv, type HoldingCsvRow } from "@/lib/utils/csv";

const row = (over: Partial<HoldingCsvRow> = {}): HoldingCsvRow => ({
  ticker: "AAPL",
  company: "Apple Inc.",
  broker: "fidelity",
  shares: 10,
  averageCost: 100,
  price: 150,
  value: 1500,
  gainLoss: 500,
  gainLossPct: 50,
  ...over,
});

describe("holdingsToCsv", () => {
  it("includes a header row and one row per holding", () => {
    const csv = holdingsToCsv([row(), row({ ticker: "MSFT" })]);
    const lines = csv.trim().split(/\r?\n/);
    expect(lines).toHaveLength(3); // header + 2
    expect(lines[0]).toContain("Ticker");
    expect(lines[0]).toContain("P&L %");
  });

  it("escapes commas in company names (the bug naive join has)", () => {
    const csv = holdingsToCsv([row({ company: "Alphabet, Inc." })]);
    // Round-trip parse must recover the exact value, proving correct quoting.
    const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true }).data;
    expect(parsed[1][1]).toBe("Alphabet, Inc.");
  });

  it("escapes quotes and newlines", () => {
    const csv = holdingsToCsv([row({ company: 'Weird "Co"\nLLC' })]);
    const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: false }).data;
    expect(parsed[1][1]).toBe('Weird "Co"\nLLC');
  });

  it("handles an empty holdings list (header only)", () => {
    const csv = holdingsToCsv([]);
    expect(csv.trim().split(/\r?\n/)).toHaveLength(1);
  });
});
