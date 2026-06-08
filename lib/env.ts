import { z } from "zod";

/**
 * Central environment validation.
 *
 * Philosophy:
 * - **Core** secrets (Supabase + encryption) are validated the first time any
 *   server code touches the environment. A missing/invalid core secret throws a
 *   single aggregated, human-readable error — the app fails loudly instead of
 *   silently running with placeholder values.
 * - **Feature** secrets (cron, Alpaca, each broker) are validated lazily in their
 *   own getter, so a route that doesn't need Alpaca won't crash because Alpaca
 *   keys are absent — but the moment you hit a price route without them, you get
 *   a precise error naming exactly what's missing.
 *
 * There are NO placeholder fallbacks anywhere. If it's not configured, it fails.
 */

const PLACEHOLDER_PATTERNS = [
  "your_",
  "replace_me",
  "changeme",
  "placeholder",
  "xxxxxxxx",
  "random_32_character",
  "your_32_character",
];

function looksLikePlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => v.includes(p));
}

const notPlaceholder = (value: string) => !looksLikePlaceholder(value);
const placeholderMsg = (label: string) => ({
  message: `${label} is still a template placeholder — set a real value`,
});

// ---------------------------------------------------------------------------
// Core schema — always required for the app to function at all.
// ---------------------------------------------------------------------------
const coreSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL (https://xxxx.supabase.co)"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short to be a real anon key")
    .refine(notPlaceholder, placeholderMsg("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "SUPABASE_SERVICE_ROLE_KEY looks too short to be a real service-role key")
    .refine(notPlaceholder, placeholderMsg("SUPABASE_SERVICE_ROLE_KEY")),
  ENCRYPTION_KEY: z
    .string()
    .min(16, "ENCRYPTION_KEY must be at least 16 characters (use: openssl rand -hex 32)")
    .refine(notPlaceholder, placeholderMsg("ENCRYPTION_KEY")),
});

export type CoreEnv = z.infer<typeof coreSchema>;

let cachedCore: CoreEnv | null = null;

function formatZodError(error: z.ZodError): string {
  const lines = error.issues.map((i) => {
    const path = i.path.join(".") || "(root)";
    return `  • ${path}: ${i.message}`;
  });
  return lines.join("\n");
}

/**
 * Validate + return the core environment. Throws a single aggregated error if
 * anything required is missing or malformed. Cached after first success.
 */
export function getEnv(): CoreEnv {
  if (cachedCore) return cachedCore;

  const parsed = coreSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Invalid or missing required environment variables:\n" +
        formatZodError(parsed.error) +
        "\n\nSee .env.example for the full list and setup instructions."
    );
  }

  cachedCore = parsed.data;
  return cachedCore;
}

// ---------------------------------------------------------------------------
// Feature getters — validated lazily, scoped errors.
// ---------------------------------------------------------------------------

/** Cron secret used to authenticate Vercel Cron calls to /api/sync/all. */
export function getCronSecret(): string {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim().length < 16 || looksLikePlaceholder(secret)) {
    throw new Error(
      "CRON_SECRET is missing or weak. Generate one with `openssl rand -hex 32` and set it in your environment (and in Vercel)."
    );
  }
  return secret;
}

/** Alpaca market-data credentials. */
export function getAlpacaCreds(): { keyId: string; secretKey: string } {
  const keyId = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  if (!keyId || !secretKey || looksLikePlaceholder(keyId) || looksLikePlaceholder(secretKey)) {
    throw new Error(
      "Alpaca credentials are not configured. Set ALPACA_API_KEY and ALPACA_SECRET_KEY (free keys at https://alpaca.markets)."
    );
  }
  return { keyId, secretKey };
}

/** True if Alpaca market-data credentials are configured (no throw). */
export function isAlpacaConfigured(): boolean {
  try {
    getAlpacaCreds();
    return true;
  } catch {
    return false;
  }
}

export type SupportedOAuthBroker = "etrade" | "schwab";

interface BrokerOAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Validate + return a broker's OAuth credentials. Throws a clear, broker-named
 * error if the integration isn't configured — surfaced to the UI as a graceful
 * "not configured" state rather than a crash.
 */
export function getBrokerOAuthEnv(broker: SupportedOAuthBroker): BrokerOAuthEnv {
  const map: Record<SupportedOAuthBroker, { id?: string; secret?: string; redirect?: string; label: string }> = {
    etrade: {
      id: process.env.ETRADE_CONSUMER_KEY,
      secret: process.env.ETRADE_CONSUMER_SECRET,
      redirect: process.env.ETRADE_REDIRECT_URI,
      label: "E*TRADE",
    },
    schwab: {
      id: process.env.SCHWAB_CLIENT_ID,
      secret: process.env.SCHWAB_CLIENT_SECRET,
      redirect: process.env.SCHWAB_REDIRECT_URI,
      label: "Charles Schwab",
    },
  };

  const cfg = map[broker];
  const missing: string[] = [];
  if (!cfg.id || looksLikePlaceholder(cfg.id)) missing.push(`${broker.toUpperCase()} client id`);
  if (!cfg.secret || looksLikePlaceholder(cfg.secret)) missing.push(`${broker.toUpperCase()} client secret`);
  if (!cfg.redirect || looksLikePlaceholder(cfg.redirect)) missing.push(`${broker.toUpperCase()} redirect URI`);

  if (missing.length > 0 || !cfg.id || !cfg.secret || !cfg.redirect) {
    throw new BrokerNotConfiguredError(
      `${cfg.label} is not configured on this deployment (missing: ${missing.join(", ")}).`
    );
  }

  return { clientId: cfg.id, clientSecret: cfg.secret, redirectUri: cfg.redirect };
}

/** Returns true if a broker's OAuth integration is fully configured. */
export function isBrokerConfigured(broker: SupportedOAuthBroker): boolean {
  try {
    getBrokerOAuthEnv(broker);
    return true;
  } catch {
    return false;
  }
}

/** Robinhood uses an UNOFFICIAL API and is OFF unless explicitly enabled. */
export function isRobinhoodExperimentalEnabled(): boolean {
  return process.env.ENABLE_ROBINHOOD_EXPERIMENTAL === "true";
}

/** Thrown when a broker integration's env is absent — handled gracefully in UI. */
export class BrokerNotConfiguredError extends Error {
  readonly code = "BROKER_NOT_CONFIGURED";
  constructor(message: string) {
    super(message);
    this.name = "BrokerNotConfiguredError";
  }
}

/** Optional Upstash Redis (production rate limiting). Falls back to in-memory. */
export function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token && !looksLikePlaceholder(url) && !looksLikePlaceholder(token)) {
    return { url, token };
  }
  return null;
}

export const isProduction = process.env.NODE_ENV === "production";
