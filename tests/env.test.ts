import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const REAL = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.realish.anon.key.value",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.realish.service.role.key",
  ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
};

function setEnv(over: Record<string, string | undefined> = {}) {
  const merged = { ...REAL, ...over };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("env validation", () => {
  beforeEach(() => {
    vi.resetModules();
    setEnv();
  });
  afterEach(() => {
    for (const k of Object.keys(REAL)) delete process.env[k];
    delete process.env.CRON_SECRET;
    delete process.env.ALPACA_API_KEY;
    delete process.env.ALPACA_SECRET_KEY;
    delete process.env.ENABLE_ROBINHOOD_EXPERIMENTAL;
    delete process.env.SCHWAB_CLIENT_ID;
    delete process.env.SCHWAB_CLIENT_SECRET;
    delete process.env.SCHWAB_REDIRECT_URI;
  });

  it("returns core env when valid", async () => {
    const { getEnv } = await import("@/lib/env");
    expect(getEnv().NEXT_PUBLIC_SUPABASE_URL).toBe(REAL.NEXT_PUBLIC_SUPABASE_URL);
  });

  it("throws an aggregated error when core vars are missing", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined, ENCRYPTION_KEY: undefined });
    vi.resetModules();
    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/required environment variables/i);
  });

  it("rejects a placeholder anon key", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "your_anon_key_here_placeholder" });
    vi.resetModules();
    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow();
  });

  it("getCronSecret throws when missing/weak", async () => {
    const { getCronSecret } = await import("@/lib/env");
    expect(() => getCronSecret()).toThrow(/CRON_SECRET/);
    process.env.CRON_SECRET = "short";
    expect(() => getCronSecret()).toThrow();
    process.env.CRON_SECRET = "a-strong-cron-secret-value-1234567890";
    expect(getCronSecret()).toBe("a-strong-cron-secret-value-1234567890");
  });

  it("getAlpacaCreds throws when missing, returns when set", async () => {
    const { getAlpacaCreds } = await import("@/lib/env");
    expect(() => getAlpacaCreds()).toThrow(/Alpaca/);
    process.env.ALPACA_API_KEY = "PKREALKEY123";
    process.env.ALPACA_SECRET_KEY = "realsecret456";
    expect(getAlpacaCreds()).toEqual({ keyId: "PKREALKEY123", secretKey: "realsecret456" });
  });

  it("isBrokerConfigured reflects presence of all three vars", async () => {
    const { isBrokerConfigured } = await import("@/lib/env");
    expect(isBrokerConfigured("schwab")).toBe(false);
    process.env.SCHWAB_CLIENT_ID = "cid";
    process.env.SCHWAB_CLIENT_SECRET = "csecret";
    process.env.SCHWAB_REDIRECT_URI = "https://app.example.com/cb";
    expect(isBrokerConfigured("schwab")).toBe(true);
  });

  it("Robinhood experimental flag defaults off", async () => {
    const { isRobinhoodExperimentalEnabled } = await import("@/lib/env");
    expect(isRobinhoodExperimentalEnabled()).toBe(false);
    process.env.ENABLE_ROBINHOOD_EXPERIMENTAL = "true";
    expect(isRobinhoodExperimentalEnabled()).toBe(true);
  });
});
