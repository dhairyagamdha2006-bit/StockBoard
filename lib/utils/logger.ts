/**
 * Safe structured logger.
 *
 * The #1 rule: NEVER leak secrets or user financial details into logs. Any
 * context object passed here is deep-redacted — values under sensitive keys are
 * replaced with "[REDACTED]" before anything is written. We also never accept or
 * print raw request bodies.
 *
 * Usage:
 *   logger.info("price fetch", { route: "/api/prices", userId, status: 200 });
 *   logger.error("sync failed", { broker: "schwab", route, status: 502 });
 */

export type LogLevel = "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

// Substrings that mark a key as sensitive (case-insensitive).
const SENSITIVE_KEY_PATTERNS = [
  "access_token",
  "refresh_token",
  "token",
  "password",
  "passwd",
  "mfa",
  "authorization",
  "cookie",
  "auth_code",
  "code",
  "secret",
  "client_secret",
  "service_role",
  "api_key",
  "apikey",
  "alpaca",
  "cron",
  "encryption",
  "session",
  "ssn",
];

const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((p) => k.includes(p));
}

/** Deep-redact a value: any sensitive key's value becomes "[REDACTED]". */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[Object]"; // guard against deep/cyclic structures
  if (value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

function emit(level: LogLevel, message: string, context?: LogContext) {
  const safeContext = context ? (redact(context) as LogContext) : undefined;
  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...(safeContext ?? {}),
  };

  // Single JSON line — friendly for serverless log drains.
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Optional, best-effort Sentry capture (no-op unless configured & installed).
  if (level === "error") void captureToSentry(message, safeContext);
}

export const logger = {
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};

// ---------------------------------------------------------------------------
// Optional Sentry — entirely opt-in. If SENTRY_DSN is unset or @sentry/nextjs
// isn't installed, this is a silent no-op. Never required for build/CI.
// ---------------------------------------------------------------------------
let sentryChecked = false;
let sentry: { captureMessage?: (m: string, o?: unknown) => void } | null = null;

async function captureToSentry(message: string, context?: LogContext) {
  if (!process.env.SENTRY_DSN) return;
  try {
    if (!sentryChecked) {
      sentryChecked = true;
      // Computed specifier so bundlers/TS don't try to resolve an optional,
      // uninstalled package at build time. Silent no-op if absent.
      const pkg = ["@sentry", "nextjs"].join("/");
      sentry = await import(/* webpackIgnore: true */ /* @vite-ignore */ pkg).catch(() => null);
    }
    sentry?.captureMessage?.(message, { level: "error", extra: context });
  } catch {
    // Logging/monitoring must never throw.
  }
}
