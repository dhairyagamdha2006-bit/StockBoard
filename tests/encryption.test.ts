import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const GOOD_KEY = "0123456789abcdef0123456789abcdef";

describe("encryption", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = GOOD_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it("round-trips plaintext through encrypt/decrypt", async () => {
    const { encrypt, decrypt } = await import("@/lib/utils/encryption");
    const secret = "super-secret-broker-token-xyz";
    const ciphertext = encrypt(secret);
    expect(ciphertext).not.toContain(secret);
    expect(decrypt(ciphertext)).toBe(secret);
  });

  it("produces different ciphertext each time (random IV)", async () => {
    const { encrypt } = await import("@/lib/utils/encryption");
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("reports configured when a real key is set", async () => {
    const { isEncryptionConfigured } = await import("@/lib/utils/encryption");
    expect(isEncryptionConfigured()).toBe(true);
  });

  it("throws (and reports not configured) when key is missing", async () => {
    delete process.env.ENCRYPTION_KEY;
    vi.resetModules();
    const { encrypt, isEncryptionConfigured } = await import("@/lib/utils/encryption");
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY is not set/);
  });

  it("throws on the template placeholder key", async () => {
    process.env.ENCRYPTION_KEY = "your_32_character_random_string_here";
    vi.resetModules();
    const { encrypt } = await import("@/lib/utils/encryption");
    expect(() => encrypt("x")).toThrow(/placeholder/);
  });

  it("throws on a too-short key", async () => {
    process.env.ENCRYPTION_KEY = "short";
    vi.resetModules();
    const { encrypt } = await import("@/lib/utils/encryption");
    expect(() => encrypt("x")).toThrow(/too short/);
  });

  it("rejects malformed ciphertext", async () => {
    const { decrypt } = await import("@/lib/utils/encryption");
    expect(() => decrypt("AAAA")).toThrow(/malformed or truncated/);
  });
});
