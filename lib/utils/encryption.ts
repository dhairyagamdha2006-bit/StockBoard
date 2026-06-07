import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * AES-256-GCM authenticated encryption for broker tokens at rest.
 *
 * Security notes:
 * - There is NO fallback key. If ENCRYPTION_KEY is missing or too weak the
 *   module throws immediately, so we never silently encrypt with a guessable
 *   zero key.
 * - The 32-byte AES key is derived from ENCRYPTION_KEY with scrypt (a slow KDF)
 *   so any reasonable-length secret works, while still producing a stable key
 *   across processes (deterministic salt).
 * - Output layout: base64( iv[12] || authTag[16] || ciphertext ).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const MIN_SECRET_LENGTH = 16;

// A fixed application salt. The real secret entropy lives in ENCRYPTION_KEY;
// scrypt stretches it into a uniformly-distributed 32-byte AES key.
const KDF_SALT = "stockboard.v1.token-encryption";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.ENCRYPTION_KEY;

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32` and add it to your environment before storing broker tokens."
    );
  }

  if (secret.trim().length < MIN_SECRET_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY is too short (min ${MIN_SECRET_LENGTH} characters). Generate a strong key with \`openssl rand -hex 32\`.`
    );
  }

  // Reject the obvious placeholder from the .env template.
  if (secret.includes("your_32_character") || secret.includes("random_32_character")) {
    throw new Error(
      "ENCRYPTION_KEY is still the template placeholder. Generate a real key with `openssl rand -hex 32`."
    );
  }

  cachedKey = scryptSync(secret.trim(), KDF_SALT, KEY_LENGTH);
  return cachedKey;
}

/** Returns true if a usable ENCRYPTION_KEY is configured (no throw). */
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");

  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Ciphertext is malformed or truncated.");
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
