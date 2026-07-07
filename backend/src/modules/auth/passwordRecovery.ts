import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import type { RowDataPacket } from "mysql2/promise";
import { getConfig } from "../../config/env.js";
import { getPool, withTransaction } from "../../database/pool.js";
import { revealSettingValue } from "../../security/settingSecrets.js";

const RESET_MINUTES = 30;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function schoolMailSettings(schoolId: number) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT setting_key, setting_value
     FROM v2_school_settings
     WHERE school_id = ? AND setting_key IN
       ('smtp_host','smtp_port','smtp_username','smtp_password','smtp_from_email','smtp_from_name')`,
    [schoolId],
  );
  return Object.fromEntries(rows.map((row: any) => {
    const key = String(row.setting_key);
    return [key, revealSettingValue(key, String(row.setting_value || ""))];
  }));
}

async function sendResetEmail(schoolId: number, email: string, name: string, resetUrl: string) {
  const settings = await schoolMailSettings(schoolId);
  if (!settings.smtp_host || !settings.smtp_username || !settings.smtp_password || !settings.smtp_from_email) {
    throw new Error("School SMTP settings are incomplete.");
  }
  const port = Number(settings.smtp_port || 587);
  const transport = nodemailer.createTransport({
    host: settings.smtp_host,
    port,
    secure: port === 465,
    auth: { user: settings.smtp_username, pass: settings.smtp_password },
  });
  await transport.sendMail({
    from: { name: settings.smtp_from_name || "Montessori Schools", address: settings.smtp_from_email },
    to: email,
    subject: "Reset your Montessori Portal password",
    text: `Hello ${name},\n\nUse this secure link within ${RESET_MINUTES} minutes to reset your password:\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Hello ${name},</p><p>Use the secure link below within ${RESET_MINUTES} minutes to reset your password.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}

export async function requestPasswordReset(schoolId: number, email: string, requestedIp?: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT u.id userId, u.name, u.email, u.is_active active, usr.school_id schoolId
     FROM v2_users u
     JOIN v2_user_school_roles usr ON usr.user_id = u.id
     WHERE LOWER(u.email) = LOWER(?) AND (? = 0 OR usr.school_id = ?)
     ORDER BY usr.role_code = 'group_super_admin' DESC
     LIMIT 1`,
    [email, schoolId, schoolId],
  );
  const account = rows[0] as any;
  if (!account?.active) return;

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await withTransaction(async connection => {
    await connection.execute(
      "UPDATE v2_password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL",
      [account.userId],
    );
    await connection.execute(
      `INSERT INTO v2_password_reset_tokens
       (user_id, school_id, token_hash, expires_at, requested_ip)
       VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), ?)`,
      [account.userId, account.schoolId, tokenHash, RESET_MINUTES, requestedIp || null],
    );
  });

  const frontend = getConfig().FRONTEND_ORIGIN.split(",")[0]!.trim().replace(/\/+$/, "");
  const resetUrl = `${frontend}/reset-password?token=${encodeURIComponent(token)}&schoolId=${account.schoolId}`;
  try {
    await sendResetEmail(account.schoolId, account.email, account.name, resetUrl);
  } catch (error) {
    if (getConfig().NODE_ENV === "production") console.error("Password recovery email delivery failed.");
    else console.warn(`Password recovery email delivery failed: ${(error as Error).message}\nDevelopment reset URL: ${resetUrl}`);
  }
}

export async function resetPassword(schoolId: number, token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  return withTransaction(async connection => {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, user_id userId
       FROM v2_password_reset_tokens
       WHERE school_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
       LIMIT 1 FOR UPDATE`,
      [schoolId, tokenHash],
    );
    const reset = rows[0] as any;
    if (!reset) throw Object.assign(new Error("This password reset link is invalid or has expired."), { statusCode: 400 });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await connection.execute("UPDATE v2_users SET password_hash = ? WHERE id = ?", [passwordHash, reset.userId]);
    await connection.execute("UPDATE v2_password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?", [reset.id]);
    await connection.execute(
      `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
       VALUES (?, ?, 'user', ?, 'auth.password_reset', JSON_OBJECT('method','self_service'))`,
      [schoolId, reset.userId, reset.userId],
    );
    return { message: "Password updated. You can now sign in." };
  });
}
