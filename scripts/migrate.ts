// Jalankan migrasi drizzle ke MySQL: pnpm db:migrate
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL kosong");
  const pool = mysql.createPool({ uri: url, timezone: "Z" });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle/migrations" });
  await pool.end();
  console.log("migrate OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
