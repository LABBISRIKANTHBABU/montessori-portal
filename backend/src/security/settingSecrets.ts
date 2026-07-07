import { decryptField, encryptField } from "./fieldEncryption.js";

const PREFIX = "enc:v1:";
export const SECRET_SETTING_KEYS = new Set([
  "smtp_password",
  "sms_api_key",
  "sms_api_secret",
  "whatsapp_access_token",
]);

export function protectSettingValue(key: string, value: string) {
  if (!SECRET_SETTING_KEYS.has(key) || !value) return value;
  const encrypted = encryptField(value);
  return encrypted ? `${PREFIX}${encrypted.toString("base64")}` : "";
}

export function revealSettingValue(key: string, value: string) {
  if (!SECRET_SETTING_KEYS.has(key) || !value.startsWith(PREFIX)) return value;
  return decryptField(Buffer.from(value.slice(PREFIX.length), "base64")) || "";
}
