/**
 * config.server.ts — Server-only config reader/writer.
 *
 * Sensitive fields (googleClientSecret, authSecret) are encrypted with
 * AES-256-GCM before being written to config.json.
 *
 * Encryption key: ~/.ndg-secret  (32 random bytes, base64-encoded)
 *   • Lives outside the project directory → unaffected by git, zip archives,
 *     or backup services that only sync the project folder.
 *   • Created automatically on first run if it doesn't exist.
 *
 * config.json format (encrypted):
 * {
 *   "googleClientId": "<plain>",                  // semi-public, kept plain
 *   "googleClientSecret_enc": { iv, ct, tag },    // AES-256-GCM
 *   "authSecret_enc": { iv, ct, tag },            // AES-256-GCM
 *   "configured": true
 * }
 *
 * Backward compatible: plain-text googleClientSecret / authSecret fields from
 * the old format are migrated to encrypted format on the next saveConfig() call.
 */

import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_PATH  = path.join(process.cwd(), "config.json");
const SECRET_PATH  = path.join(os.homedir(), ".ndg-secret");

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AppConfig {
  googleClientId:     string;
  googleClientSecret: string;
  authSecret:         string;
  configured:         boolean;
}

interface EncryptedField {
  iv:  string;   // 12-byte IV, base64
  ct:  string;   // ciphertext, base64
  tag: string;   // 16-byte GCM auth tag, base64
}

interface StoredConfig {
  googleClientId:        string;
  // Encrypted format (new):
  googleClientSecret_enc?: EncryptedField;
  authSecret_enc?:         EncryptedField;
  // Plain-text format (old — migrated on next save):
  googleClientSecret?:     string;
  authSecret?:             string;
  configured:              boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Key management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load the 32-byte encryption key from ~/.ndg-secret.
 * If the file doesn't exist, generate a new random key and persist it.
 */
function loadOrCreateKey(): Buffer {
  if (fs.existsSync(SECRET_PATH)) {
    const b64 = fs.readFileSync(SECRET_PATH, "utf-8").trim();
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) {
      throw new Error(
        `~/.ndg-secret is corrupted (expected 32 bytes, got ${key.length}). ` +
        "Delete the file and restart the app to regenerate it."
      );
    }
    return key;
  }

  // First run — generate and persist a new key.
  const key = crypto.randomBytes(32);
  fs.writeFileSync(SECRET_PATH, key.toString("base64"), { encoding: "utf-8", mode: 0o600 });
  return key;
}

// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM helpers
// ─────────────────────────────────────────────────────────────────────────────

function encrypt(plaintext: string, key: Buffer): EncryptedField {
  const iv         = crypto.randomBytes(12);
  const cipher     = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct         = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag        = cipher.getAuthTag();
  return {
    iv:  iv.toString("base64"),
    ct:  ct.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decrypt(field: EncryptedField, key: Buffer): string {
  const iv         = Buffer.from(field.iv,  "base64");
  const ct         = Buffer.from(field.ct,  "base64");
  const tag        = Buffer.from(field.tag, "base64");
  const decipher   = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct) + decipher.final("utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

function generateSecret(): string {
  return crypto.randomBytes(32).toString("base64");
}

export function readConfig(): AppConfig {
  // ── 1. Try config.json ──────────────────────────────────────────────────
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const stored: StoredConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

      if (stored.googleClientId) {
        const key = loadOrCreateKey();

        const googleClientSecret = stored.googleClientSecret_enc
          ? decrypt(stored.googleClientSecret_enc, key)
          : stored.googleClientSecret ?? "";

        const authSecret = stored.authSecret_enc
          ? decrypt(stored.authSecret_enc, key)
          : stored.authSecret ?? generateSecret();

        return {
          googleClientId: stored.googleClientId,
          googleClientSecret,
          authSecret,
          configured: !!(stored.googleClientId && googleClientSecret),
        };
      }
    }
  } catch {
    // fall through to env vars
  }

  // ── 2. Fall back to environment variables ───────────────────────────────
  const clientId     = process.env.GOOGLE_CLIENT_ID     ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  return {
    googleClientId:     clientId,
    googleClientSecret: clientSecret,
    authSecret:         process.env.AUTH_SECRET ?? generateSecret(),
    configured:         !!(clientId && clientSecret),
  };
}

export function saveConfig(googleClientId: string, googleClientSecret: string): AppConfig {
  const existing   = readConfig();
  const authSecret = existing.authSecret || generateSecret();
  const key        = loadOrCreateKey();

  const stored: StoredConfig = {
    googleClientId,
    googleClientSecret_enc: encrypt(googleClientSecret, key),
    authSecret_enc:         encrypt(authSecret, key),
    configured: true,
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(stored, null, 2), "utf-8");

  return {
    googleClientId,
    googleClientSecret,
    authSecret,
    configured: true,
  };
}
