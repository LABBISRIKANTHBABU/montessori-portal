import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { withTransaction } from "../database/pool.js";
import { getConfig } from "../config/env.js";

getConfig();
const emailIndex = process.argv.indexOf("--email");
const email = process.argv[emailIndex + 1]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Usage: npm run user:reset-password -- --email "admin@example.com"');
}
const temporaryPassword = `M!${randomBytes(12).toString("base64url")}7a`;
const passwordHash = await bcrypt.hash(temporaryPassword, 12);
await withTransaction(async connection => {
  const [users] = await connection.execute<RowDataPacket[]>(
    "SELECT u.id, usr.school_id FROM v2_users u JOIN v2_user_school_roles usr ON usr.user_id = u.id WHERE LOWER(u.email) = LOWER(?) LIMIT 1",
    [email]
  );
  if (!users[0]) throw new Error("No active v2 account exists for this email.");
  const [updated] = await connection.execute<ResultSetHeader>(
    "UPDATE v2_users SET password_hash = ?, force_password_reset = 1, is_active = 1 WHERE id = ?",
    [passwordHash, users[0].id]
  );
  if (updated.affectedRows !== 1) throw new Error("Password reset did not update exactly one account.");
  await connection.execute(
    `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
     VALUES (?, NULL, 'user', ?, 'user.password.reset', JSON_OBJECT('method', 'administrator_cli'))`,
    [users[0].school_id, users[0].id]
  );
});
console.log(`Password reset for ${email}.`);
console.log(`Temporary password: ${temporaryPassword}`);
console.log("Copy it now. It is shown once and must be changed at first login.");

