import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Application-level encryption for Plaid access tokens.
 *
 * Neon already encrypts the underlying disk, so this is not about physical
 * media — it is about DATABASE_URL compromise. With the tokens encrypted under
 * a key that lives only in the environment, a leaked connection string yields
 * ciphertext instead of the ability to pull every transaction on the account.
 *
 * AES-256-GCM: authenticated, so tampering fails loudly rather than silently
 * decrypting to garbage that then gets sent to Plaid.
 *
 * Stored format: v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>
 * The version prefix exists so the format can change without guessing.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the GCM standard
const KEY_BYTES = 32;

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    // Fail closed. Silently storing plaintext because a variable is missing is
    // exactly the failure this module exists to prevent.
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set — refusing to handle Plaid access tokens."
    );
  }

  const buf = Buffer.from(raw, "hex");
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes of hex (${KEY_BYTES * 2} characters); got ${buf.length}.`
    );
  }
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");

  if (parts.length !== 4 || parts[0] !== VERSION) {
    // Strict on purpose: no passthrough for legacy plaintext. A row that was
    // never migrated should surface as an error, not quietly keep working.
    throw new Error("Stored secret is not in the expected v1 encrypted format.");
  }

  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** True if the value is already ciphertext, used only by the migration. */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(`${VERSION}:`) && stored.split(":").length === 4;
}

/** Exported for tests: verifies a round trip without exposing the key. */
export function selfTest(): boolean {
  const sample = `access-sandbox-${randomBytes(8).toString("hex")}`;
  const out = decryptSecret(encryptSecret(sample));
  return timingSafeEqual(Buffer.from(out), Buffer.from(sample));
}
