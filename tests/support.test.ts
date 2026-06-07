import { describe, it, expect } from "vitest";
import { BROKER_SUPPORT, ALL_BROKERS } from "@/lib/brokers/support";

describe("broker support matrix (honesty)", () => {
  it("covers every broker", () => {
    expect(ALL_BROKERS.sort()).toEqual(["etrade", "fidelity", "robinhood", "schwab"]);
    for (const b of ALL_BROKERS) expect(BROKER_SUPPORT[b]).toBeTruthy();
  });

  it("labels Robinhood as experimental/unofficial (not production)", () => {
    const rh = BROKER_SUPPORT.robinhood;
    expect(rh.kind).toBe("experimental-unofficial");
    expect(rh.tier).toBe("experimental");
    expect(rh.summary.toLowerCase()).toContain("unofficial");
  });

  it("labels Fidelity as a working CSV import (no approval)", () => {
    expect(BROKER_SUPPORT.fidelity.kind).toBe("csv-import");
    expect(BROKER_SUPPORT.fidelity.tier).toBe("available");
    expect(BROKER_SUPPORT.fidelity.canApiSync).toBe(false);
  });

  it("labels Schwab and E*TRADE as official OAuth requiring approval", () => {
    for (const b of ["schwab", "etrade"] as const) {
      expect(BROKER_SUPPORT[b].kind).toBe("oauth-official");
      expect(BROKER_SUPPORT[b].tier).toBe("requires-approval");
      expect(BROKER_SUPPORT[b].canApiSync).toBe(true);
    }
  });
});
