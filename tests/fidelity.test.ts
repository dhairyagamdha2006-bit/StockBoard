import { describe, it, expect } from "vitest";
import { parseFidelityCSV } from "@/lib/brokers/fidelity";

const VALID = `Account Number,Account Name,Symbol,Description,Quantity,Last Price,Average Cost Basis,Current Value,Today's Gain/Loss Dollar,Total Gain/Loss Dollar
X123,Individual,AAPL,APPLE INC,10,$150.00,$100.00,$1500.00,$20.00,$500.00
X123,Individual,MSFT,MICROSOFT CORP,5,$400.00,$350.00,$2000.00,-$10.00,$250.00
X123,Individual,PENDING,Pending Activity,,,,,,
"",,**Total**,,,,,,,`;

describe("parseFidelityCSV", () => {
  it("parses valid position rows", () => {
    const holdings = parseFidelityCSV(VALID);
    expect(holdings).toHaveLength(2);
    const aapl = holdings.find((h) => h.ticker === "AAPL")!;
    expect(aapl.shares).toBe(10);
    expect(aapl.average_cost).toBe(100);
    expect(aapl.current_price).toBe(150);
    expect(aapl.company_name).toBe("APPLE INC");
  });

  it("skips total rows, blank symbols, and zero-quantity rows", () => {
    const holdings = parseFidelityCSV(VALID);
    expect(holdings.find((h) => h.ticker === "PENDING")).toBeUndefined();
    expect(holdings.find((h) => h.ticker.includes("Total"))).toBeUndefined();
  });

  it("returns an empty array for empty or header-only input", () => {
    expect(parseFidelityCSV("")).toEqual([]);
    expect(parseFidelityCSV("Symbol,Quantity\n")).toEqual([]);
  });

  it("handles malformed numbers without throwing", () => {
    const csv = `Symbol,Description,Quantity,Last Price,Average Cost Basis,Current Value
AAPL,APPLE,abc,xyz,,`;
    expect(() => parseFidelityCSV(csv)).not.toThrow();
  });
});
