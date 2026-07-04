import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { withTransaction } from "../database/pool.js";
import { getConfig } from "../config/env.js";

getConfig();
const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]?.replace(/^--/, "");
  const value = process.argv[index + 1];
  if (key && value) args.set(key, value);
}
const name = args.get("name")?.trim();
const email = args.get("email")?.trim().toLowerCase();
const schoolCode = args.get("school-code")?.trim().toUpperCase();
if (!name || !email || !schoolCode || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Usage: npm run user:provision-admin -- --name "Full Name" --email "admin@example.com" --school-code MEMHSVNK');
}
const temporaryPassword = `M!${randomBytes(12).toString("base64url")}7a`;
const passwordHash = await bcrypt.hash(temporaryPassword, 12);
const result = await withTransaction(async connection => {
  const [schools] = await connection.execute<RowDataPacket[]>("SELECT id, name FROM v2_schools WHERE legacy_code = ? LIMIT 1", [schoolCode]);
  if (!schools[0]) throw new Error(`School code ${schoolCode} was not found.`);
  const [existing] = await connection.execute<RowDataPacket[]>("SELECT id FROM v2_users WHERE LOWER(email) = LOWER(?) LIMIT 1", [email]);
  if (existing.length) throw new Error("A v2 user with this email already exists.");
  const [created] = await connection.execute<ResultSetHeader>(
    "INSERT INTO v2_users (name, email, password_hash, is_active, force_password_reset) VALUES (?, ?, ?, 1, 0)",
    [name, email, passwordHash]
  );
  await connection.execute(
    "INSERT INTO v2_user_school_roles (user_id, school_id, role_code) VALUES (?, ?, 'school_admin')",
    [created.insertId, schools[0].id]
  );
  await connection.execute(
    `INSERT INTO v2_audit_events (school_id, user_id, entity_type, entity_id, action_name, metadata_json)
     VALUES (?, NULL, 'user', ?, 'user.provision', JSON_OBJECT('role', 'school_admin'))`,
    [schools[0].id, created.insertId]
  );
  return { userId: created.insertId, school: String(schools[0].name) };
});
console.log(`Administrator created for ${result.school}.`);
console.log(`Email: ${email}`);
console.log(`Temporary password: ${temporaryPassword}`);
console.log("Copy it now. It is shown once.");
