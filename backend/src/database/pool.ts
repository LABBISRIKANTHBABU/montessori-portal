import mysql, { Pool, PoolConnection, RowDataPacket, FieldPacket } from "mysql2/promise";
import { getConfig } from "../config/env.js";

let pool: Pool | undefined;
export function getPool(): Pool {
  if (pool) return pool;
  const config = getConfig();
  pool = mysql.createPool({
    host: config.DB_HOST, port: config.DB_PORT, user: config.DB_USER, password: config.DB_PASSWORD,
    database: config.DB_NAME, connectionLimit: config.DB_CONNECTION_LIMIT, waitForConnections: true,
    queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 10_000, charset: "utf8mb4",
    timezone: "Z", dateStrings: true, ssl: config.DB_SSL ? { rejectUnauthorized: false } : undefined
  });
  return pool;
}
export async function query<T extends RowDataPacket[] = RowDataPacket[]>(sql: string, values?: any[]): Promise<[T, FieldPacket[]]> {
  return getPool().query(sql, values) as Promise<[T, FieldPacket[]]>;
}
export async function databaseHealth() {
  const started = Date.now();
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT DATABASE() database_name, UTC_TIMESTAMP() database_time");
  return { ok: true, latencyMs: Date.now() - started, database: rows[0]?.database_name, databaseTime: rows[0]?.database_time };
}
export async function withTransaction<T>(operation: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
export async function closePool() { if (pool) { await pool.end(); pool = undefined; } }
