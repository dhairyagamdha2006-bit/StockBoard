import { describe, it, expect } from "vitest";
import { BROKER_SUPPORT, ALL_BROKERS } from "@/lib/brokers/support";

describe("broker support matrix (honesty)", () => {
  it("covers every broker", () => {
    expect([...ALL_BROKERS].sort()).toEqual(["etrade", "fidelity", "robinhood", "schwab"]);
    for (const b of ALL_BROKERS) expect(BROKER_SUPPORT[b]).toBeTruthy();
  });

  it("CSV import is available for ALL brokers (the reliable default)", () => {
    for (const b of ALL_BROKERS) {
      expect(BROKER_SUPPORT[b].csvImport).toBe(true);
      expect(BROKER_SUPPORT[b].csvExportHint.length).toBeGreaterThan(0);
    }
  });

  it("only Schwab and E*TRADE expose optional OAuth", () => {
    expect(BROKER_SUPPORT.schwab.hasOAuth).toBe(true);
    expect(BROKER_SUPPORT.etrade.hasOAuth).toBe(true);
    expect(BROKER_SUPPORT.fidelity.hasOAuth).toBe(false);
    expect(BROKER_SUPPORT.robinhood.hasOAuth).toBe(false);
  });

  it("Robinhood is the only experimental login, and is described honestly", () => {
    expect(BROKER_SUPPORT.robinhood.hasExperimentalLogin).toBe(true);
    expect(BROKER_SUPPORT.robinhood.summary.toLowerCase()).toContain("experimental");
    for (const b of ["fidelity", "schwab", "etrade"] as const) {
      expect(BROKER_SUPPORT[b].hasExperimentalLogin).toBe(false);
    }
  });
});
