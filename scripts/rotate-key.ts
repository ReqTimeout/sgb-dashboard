// scripts/rotate-key.ts — S8.5 (learning rev-13): ingest key HARUS beda per tenant.
//
// STATUS 23 Sep 2026: kunci SUDAH beda per tenant di production
// (agency=b2f31218… sariglass=090729d8… — cocok dengan secrets/VPS-CREDENTIALS.md).
// Script ini TIDAK perlu dijalankan sekarang; disimpan untuk rotasi darurat
// (misal key bocor). Default DRY-RUN — tambah --execute untuk menulis DB.
//
//   pnpm tsx scripts/rotate-key.ts --tenant agency            # dry-run
//   pnpm tsx scripts/rotate-key.ts --tenant agency --execute  # ROTASI BENERAN
//
// SETELAH --execute: catat key baru ke secrets/VPS-CREDENTIALS.md (repo
// sariglassbangunan, folder secrets/ gitignored) + update SEMUA produser
// yang push dengan key lama (admin env SGB_INGEST_KEY, CAPI gateway, agent).
// JANGAN commit key ke repo ini.
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { tenants } from "../drizzle/schema";

async function main() {
  const args = process.argv.slice(2);
  const tenantSlug = args.find((a) => !a.startsWith("--")) ?? args[args.indexOf("--tenant") + 1];
  const execute = args.includes("--execute");
  if (!tenantSlug || tenantSlug.startsWith("--")) {
    console.error("Pakai: pnpm tsx scripts/rotate-key.ts --tenant <slug> [--execute]");
    process.exit(2);
  }
  const db = getDb();
  const rows = await db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
  if (!rows[0]) {
    console.error(`Tenant '${tenantSlug}' tidak ada.`);
    process.exit(1);
  }
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  console.log(`tenant : ${tenantSlug} (id ${rows[0].id})`);
  console.log(`hash lama: ${String(rows[0].ingestKeyHash).slice(0, 16)}…`);
  console.log(`hash baru: ${hash.slice(0, 16)}…`);
  if (!execute) {
    console.log("DRY-RUN — tidak ada yang ditulis. Tambah --execute untuk rotasi beneran.");
    console.log("INGAT: setelah --execute, update produser + secrets/VPS-CREDENTIALS.md.");
    return;
  }
  await db.update(tenants).set({ ingestKeyHash: hash }).where(eq(tenants.id, rows[0].id));
  console.log("OK — hash diupdate.");
  console.log(`KEY BARU (simpan ke secrets, JANGAN commit): ${raw}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
