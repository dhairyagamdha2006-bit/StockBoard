import type { BrokerName } from "@/types";

export const BROKER_NAMES: BrokerName[] = ["robinhood", "fidelity", "etrade", "schwab"];

export function isBrokerName(value: unknown): value is BrokerName {
  return typeof value === "string" && (BROKER_NAMES as string[]).includes(value);
}

/** Tickers: 1–10 chars, letters/digits/dot/dash only (covers BRK.B, options roots). */
const TICKER_RE = /^[A-Z0-9.\-]{1,10}$/;

export function isValidTicker(raw: unknown): raw is string {
  return typeof raw === "string" && TICKER_RE.test(raw.toUpperCase());
}

export function sanitizeTickers(param: string | null, max = 100): string[] {
  if (!param) return [];
  const seen = new Set<string>();
  for (const part of param.split(",")) {
    const t = part.trim().toUpperCase();
    if (t && isValidTicker(t)) seen.add(t);
    if (seen.size >= max) break;
  }
  return Array.from(seen);
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Basic length-bounded string check to reject absurd payloads. */
export function isBoundedString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

/** Robinhood MFA codes are 6 digits. */
export function isValidMfaCode(v: unknown): v is string {
  return typeof v === "string" && /^\d{4,8}$/.test(v);
}
