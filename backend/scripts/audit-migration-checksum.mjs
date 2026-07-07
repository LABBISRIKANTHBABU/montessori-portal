import "dotenv/config";
import mysql from "mysql2/promise";

const filename = process.argv[2];
if (!filename) throw new Error("Usage: node scripts/audit-migration-checksum.mjs <filename>");

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});
try {
  const [rows] = await connection.execute(
    "SELECT filename, checksum, applied_at appliedAt FROM schema_migrations WHERE filename = ?",
    [filename],
  );
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await connection.end();
}
