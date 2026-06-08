import { describe, it, expect, vi, afterEach } from "vitest";
import { redact, logger } from "@/lib/utils/logger";

describe("redact", () => {
  it("redacts sensitive top-level keys", () => {
    const out = redact({
      access_token: "secret-abc",
      refresh_token: "secret-def",
      password: "hunter2",
      mfaCode: "123456",
      authorization: "Bearer xyz",
      cookie: "sb=...",
      client_secret: "cs",
      service_role: "sr",
      api_key: "ak",
      broker: "schwab",
      status: 200,
    }) as Record<string, unknown>;

    expect(out.access_token).toBe("[REDACTED]");
    expect(out.refresh_token).toBe("[REDACTED]");
    expect(out.password).toBe("[REDACTED]");
    expect(out.mfaCode).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.cookie).toBe("[REDACTED]");
    expect(out.client_secret).toBe("[REDACTED]");
    expect(out.service_role).toBe("[REDACTED]");
    expect(out.api_key).toBe("[REDACTED]");
    // Non-sensitive values pass through.
    expect(out.broker).toBe("schwab");
    expect(out.status).toBe(200);
  });

  it("redacts nested and array values", () => {
    const out = redact({
      user: { id: "u1", session_token: "zzz" },
      items: [{ alpaca_secret_key: "k" }, { ticker: "AAPL" }],
    }) as { user: Record<string, unknown>; items: Record<string, unknown>[] };

    expect(out.user.id).toBe("u1");
    expect(out.user.session_token).toBe("[REDACTED]");
    expect(out.items[0].alpaca_secret_key).toBe("[REDACTED]");
    expect(out.items[1].ticker).toBe("AAPL");
  });

  it("matches keys case-insensitively and by substring", () => {
    const out = redact({ ENCRYPTION_KEY: "x", CRON_SECRET: "y", Some_Token_Here: "z" }) as Record<string, unknown>;
    expect(out.ENCRYPTION_KEY).toBe("[REDACTED]");
    expect(out.CRON_SECRET).toBe("[REDACTED]");
    expect(out.Some_Token_Here).toBe("[REDACTED]");
  });

  it("leaves primitives untouched", () => {
    expect(redact("plain")).toBe("plain");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBe(null);
  });
});

describe("logger output", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes a JSON line with redacted context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("sync failed", { broker: "schwab", access_token: "leak-me", status: 502 });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0][0] as string;
    expect(line).toContain('"message":"sync failed"');
    expect(line).toContain('"broker":"schwab"');
    expect(line).not.toContain("leak-me");
    expect(line).toContain("[REDACTED]");
  });
});
