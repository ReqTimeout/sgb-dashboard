import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

let _db: MySql2Database | null = null;

// Singleton pool. Copy pola sariglass-admin (terbukti di production):
// timezone "Z" (hindari bug datetime +7 jam), enableKeepAlive (hindari
// "server has gone away" di koneksi idle), process.env (runtime Coolify).
export function getDb(): MySql2Database {
  if (_db) return _db;
  const url = process.env.DATABASE_URL || (import.meta.env.DATABASE_URL as string | undefined);
  if (!url) throw new Error("DATABASE_URL kosong — set di Coolify Environment Variables");
  const pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: 5,
    timezone: "Z",
    dateStrings: false,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
  });
  _db = drizzle(pool);
  return _db;
}
