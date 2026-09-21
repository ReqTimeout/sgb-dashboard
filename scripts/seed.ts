// Seed awal: tenant agency + sariglass, superadmin Bos. Jalan sekali: pnpm db:seed
import "dotenv/config";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/session";
import { dashboardUsers, tenants } from "../drizzle/schema";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} kosong di .env`);
  return v;
}

async function main() {
  const db = getDb();
  const ingestKeyHash = createHash("sha256").update(req("SEED_TENANT_INGEST_KEY")).digest("hex");

  for (const t of [
    { slug: "agency", name: "Beriklan Agency (HQ)", domain: null },
    {
      slug: req("SEED_TENANT_SLUG"),
      name: req("SEED_TENANT_NAME"),
      domain: req("SEED_TENANT_DOMAIN"),
    },
  ]) {
    const existing = await db.select().from(tenants).where(eq(tenants.slug, t.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(tenants).values({ ...t, ingestKeyHash, configJson: null });
      console.log("tenant dibuat:", t.slug);
    } else {
      console.log("tenant sudah ada:", t.slug);
    }
  }

  const email = req("SEED_ADMIN_EMAIL");
  const existingUser = await db
    .select()
    .from(dashboardUsers)
    .where(eq(dashboardUsers.email, email))
    .limit(1);
  if (existingUser.length === 0) {
    await db.insert(dashboardUsers).values({
      tenantId: null,
      email,
      passwordHash: await hashPassword(req("SEED_ADMIN_PASSWORD")),
      role: "superadmin",
      name: "Bos Beriklan",
    });
    console.log("superadmin dibuat:", email);
  } else {
    console.log("superadmin sudah ada:", email);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
