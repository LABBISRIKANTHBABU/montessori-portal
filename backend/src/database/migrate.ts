import "dotenv/config";
import mysql, { RowDataPacket } from "mysql2/promise";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { getConfig } from "../config/env.js";

type Applied = RowDataPacket & { filename: string; checksum: string };
const command = process.argv[2] || "status";
const config = getConfig();
const migrationDirectory = resolve(process.cwd(), "../database");
if (/^(your-|replace|localhost$)/i.test(config.DB_HOST)) throw new Error("DB_HOST is still a placeholder; migration status cannot connect.");
if (command === "up" && config.NODE_ENV === "production" && !config.ALLOW_PRODUCTION_MIGRATIONS) {
  throw new Error("Production migrations are locked. Verify a restorable backup, then temporarily set ALLOW_PRODUCTION_MIGRATIONS=true.");
}
const connection = await mysql.createConnection({
  host: config.DB_HOST, port: config.DB_PORT, user: config.DB_USER, password: config.DB_PASSWORD,
  database: config.DB_NAME, charset: "utf8mb4", multipleStatements: true,
  ssl: config.DB_SSL ? { rejectUnauthorized: true } : undefined
});
try {
  if (command === "up") {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    const [[lock]] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('montessori_schema_migrations', 10) acquired");
    if (lock?.acquired !== 1) throw new Error("Could not acquire the migration lock.");
  }
  const filenames = (await readdir(migrationDirectory)).filter(file => /^\d+.*\.sql$/.test(file)).sort();
  const [[tableState]] = await connection.execute<RowDataPacket[]>(
    "SELECT COUNT(*) count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'"
  );
  const [appliedRows] = Number(tableState?.count) > 0
    ? await connection.query<Applied[]>("SELECT filename, checksum FROM schema_migrations")
    : [[] as Applied[], []];
  const applied = new Map(appliedRows.map(row => [row.filename, row.checksum]));
  const pending: { filename: string; sql: string; checksum: string }[] = [];
  for (const filename of filenames) {
    const sql = await readFile(resolve(migrationDirectory, filename), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = applied.get(filename);
    if (existing && existing !== checksum) throw new Error(`Applied migration was modified: ${filename}`);
    if (!existing) pending.push({ filename, sql, checksum });
  }
  if (command === "status" || command === "dry-run") {
    console.log(JSON.stringify({ database: config.DB_NAME, applied: applied.size, pending: pending.map(item => item.filename) }, null, 2));
  } else if (command === "up") {
    for (const migration of pending) {
      console.log(`Applying ${migration.filename}`);
      await connection.query(migration.sql);
      await connection.execute("INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)", [migration.filename, migration.checksum]);
    }
    console.log(`Applied ${pending.length} migration(s).`);
  } else throw new Error("Use migrate:status, migrate:dry-run or migrate:up.");
} finally {
  if (command === "up") { try { await connection.query("SELECT RELEASE_LOCK('montessori_schema_migrations')"); } catch {} }
  await connection.end();
}
