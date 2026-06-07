import type { BrokerName } from "@/types";

/**
 * Honest broker support matrix.
 *
 * This is the single source of truth for what each integration actually is —
 * used by the UI, the connect pages, and the README. We do NOT claim a broker
 * "works in production" unless its flow is implemented; approval/credential
 * requirements are stated plainly.
 */

export type IntegrationKind =
  | "oauth-official" // Official broker OAuth API
  | "csv-import" // Manual CSV upload
  | "experimental-unofficial"; // Reverse-engineered private API — risky

export type SupportTier =
  | "available" // Works out of the box once env is set
  | "requires-approval" // Implemented, but needs broker developer approval/keys
  | "experimental"; // Unofficial / off by default / not for real accounts

export interface BrokerSupport {
  broker: BrokerName;
  displayName: string;
  kind: IntegrationKind;
  tier: SupportTier;
  /** Honest one-line description of what this integration really is. */
  summary: string;
  /** Whether a server-side API pull of holdings is implemented. */
  canApiSync: boolean;
  /** What the operator must configure/obtain to enable it. */
  requirements: string[];
}

export const BROKER_SUPPORT: Record<BrokerName, BrokerSupport> = {
  fidelity: {
    broker: "fidelity",
    displayName: "Fidelity",
    kind: "csv-import",
    tier: "available",
    summary: "Manual CSV import of your positions export. Fully working — no API approval needed.",
    canApiSync: false,
    requirements: ["No credentials required — just export Positions as CSV from Fidelity."],
  },
  schwab: {
    broker: "schwab",
    displayName: "Charles Schwab",
    kind: "oauth-official",
    tier: "requires-approval",
    summary:
      "Official Schwab Trader API (OAuth 2.0, read-only). Implemented, but requires an approved Schwab developer app.",
    canApiSync: true,
    requirements: [
      "An approved Charles Schwab developer application",
      "SCHWAB_CLIENT_ID, SCHWAB_CLIENT_SECRET, SCHWAB_REDIRECT_URI",
      "An HTTPS callback URL registered with Schwab",
    ],
  },
  etrade: {
    broker: "etrade",
    displayName: "E*TRADE",
    kind: "oauth-official",
    tier: "requires-approval",
    summary:
      "Official E*TRADE API (OAuth 1.0a, read-only). Implemented with sandbox support; requires a developer consumer key.",
    canApiSync: true,
    requirements: [
      "An E*TRADE developer consumer key/secret (sandbox keys work for testing)",
      "ETRADE_CONSUMER_KEY, ETRADE_CONSUMER_SECRET, ETRADE_REDIRECT_URI",
    ],
  },
  robinhood: {
    broker: "robinhood",
    displayName: "Robinhood",
    kind: "experimental-unofficial",
    tier: "experimental",
    summary:
      "EXPERIMENTAL: uses Robinhood's unofficial private API with username/password. Off by default. Not recommended for real accounts — Robinhood has no public API and this may break or risk your account.",
    canApiSync: true,
    requirements: [
      "Set ENABLE_ROBINHOOD_EXPERIMENTAL=true to enable (you accept the risk)",
      "Intended for demos/testing, not production use with real money",
    ],
  },
};

export const ALL_BROKERS: BrokerName[] = ["fidelity", "schwab", "etrade", "robinhood"];
