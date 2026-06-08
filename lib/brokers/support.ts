import type { BrokerName } from "@/types";

/**
 * Honest broker support matrix — the single source of truth used by the UI,
 * the connect pages, and the README.
 *
 * The reliable default for EVERY broker is CSV import (no approval needed).
 * OAuth is an optional advanced upgrade for Schwab/E*TRADE when configured.
 * Robinhood's unofficial username/password login stays experimental + off.
 */

export type SupportTier =
  | "csv" // CSV import is the primary method
  | "csv-plus-oauth" // CSV works now; OAuth optional when configured
  | "csv-plus-experimental"; // CSV works now; unofficial login is experimental/off

export interface BrokerSupport {
  broker: BrokerName;
  displayName: string;
  tier: SupportTier;
  /** Honest one-line description of how this broker connects. */
  summary: string;
  /** CSV import is available for every broker. */
  csvImport: true;
  /** Whether an official OAuth API integration exists (optional, when configured). */
  hasOAuth: boolean;
  /** Whether an experimental unofficial login exists (off by default). */
  hasExperimentalLogin: boolean;
  /** Where to export the CSV from this broker. */
  csvExportHint: string;
}

export const BROKER_SUPPORT: Record<BrokerName, BrokerSupport> = {
  fidelity: {
    broker: "fidelity",
    displayName: "Fidelity",
    tier: "csv",
    summary: "Import your positions via CSV. Works out of the box — no credentials needed.",
    csvImport: true,
    hasOAuth: false,
    hasExperimentalLogin: false,
    csvExportHint: "Fidelity → Accounts & Trade → Portfolio → Positions → Download (CSV).",
  },
  schwab: {
    broker: "schwab",
    displayName: "Charles Schwab",
    tier: "csv-plus-oauth",
    summary:
      "Import via CSV out of the box. Optional: connect Schwab's official read-only OAuth API if you have an approved developer app.",
    csvImport: true,
    hasOAuth: true,
    hasExperimentalLogin: false,
    csvExportHint: "Schwab → Accounts → Positions → Export (CSV).",
  },
  etrade: {
    broker: "etrade",
    displayName: "E*TRADE",
    tier: "csv-plus-oauth",
    summary:
      "Import via CSV out of the box. Optional: connect E*TRADE's official read-only OAuth API if you have developer keys.",
    csvImport: true,
    hasOAuth: true,
    hasExperimentalLogin: false,
    csvExportHint: "E*TRADE → Portfolios → Download (CSV).",
  },
  robinhood: {
    broker: "robinhood",
    displayName: "Robinhood",
    tier: "csv-plus-experimental",
    summary:
      "Import via CSV (recommended). Robinhood has no public API; the unofficial username/password login is experimental and disabled by default — not recommended for real accounts.",
    csvImport: true,
    hasOAuth: false,
    hasExperimentalLogin: true,
    csvExportHint: "Use a Symbol, Shares, Average Cost, Price CSV (see the template on the import page).",
  },
};

export const ALL_BROKERS: BrokerName[] = ["fidelity", "schwab", "etrade", "robinhood"];
