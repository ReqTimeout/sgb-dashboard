import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // drizzle-kit baca env langsung (bukan via dotenv) — export dulu atau prefix:
    // DATABASE_URL="mysql://..." pnpm db:generate
    url: process.env.DATABASE_URL ?? "",
  },
});
