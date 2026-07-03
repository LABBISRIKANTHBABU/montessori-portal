import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getConfig } from "../config/env.js";

function key() {
  const value = getConfig().DATA_ENCRYPTION_KEY;
  if (!value) throw new Error("Sensitive-field encryption is not configured.");
  return Buffer.from(value, "base64");
}
export function encryptField(value?: string): Buffer | null {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}
export function decryptField(payload?: Buffer | null): string | null {
  if (!payload) return null;
  const decipher = createDecipheriv("aes-256-gcm", key(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}
export function lastFour(value?: string) { return value ? value.replace(/\D/g, "").slice(-4) || null : null; }
