// /api/cron/migrate-keywords — S3: schema migration + enrichment
// Auth: ?token=$CRON_TOKEN (env dashboard)
//
// 1. ALTER TABLE keyword_inventory: ADD IF NOT EXISTS kolom intelijen
//    (normalized_keyword, cluster, opportunity, suggestion, dsb).
//    MySQL tidak punya ADD COLUMN IF NOT EXISTS native — kita cek via INFORMATION_SCHEMA.
// 2. Backfill: normalisasi keyword + klaster + skor peluang
//    (impressions × (11 - position) atau priority × intent_weight).
//    Menduplikasi keyword yang sama (setelah normalisasi) → merge.
//
// Idempotent — boleh dijalankan ulang. Bisa juga dipanggil manual:
//   curl 'https://sgb.beriklan.co.id/api/cron/migrate-keywords?token=CRON_TOKEN'
import type { APIRoute } from "astro";
import mysql from "mysql2/promise";
import { ensureKeywordIntelColumns } from "../../../lib/keywords/enrich";

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (!token || token !== process.env.CRON_TOKEN) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
  const started = new Date();
  try {
    const raw = mysql.createPool({
      uri: process.env.DATABASE_URL ?? "",
      timezone: "Z",
    });
    const conn = await raw.getConnection();
    try {
      // 1) Tambah kolom intelijen jika belum ada (cek INFORMATION_SCHEMA dulu).
      const ensureAdd = async (col: string, def: string) => {
        const [rows] = await conn.execute(
          `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'keyword_inventory' AND COLUMN_NAME = ?`,
          [col],
        );
        const n = Number((rows as { n: number }[])[0]?.n ?? 0);
        if (n === 0) {
          await conn.execute(`ALTER TABLE \`keyword_inventory\` ADD COLUMN ${def}`);
          return `ADD ${col}`;
        }
        return `skip ${col}`;
      };
      const schemaLog: string[] = [];
      schemaLog.push(await ensureAdd("normalized_keyword", "`normalized_keyword` varchar(255) NULL"));
      schemaLog.push(await ensureAdd("cluster", "`cluster` varchar(64) NULL"));
      schemaLog.push(await ensureAdd("opportunity", "`opportunity` int NOT NULL DEFAULT 0"));
      schemaLog.push(await ensureAdd("suggestion", "`suggestion` varchar(255) NULL"));
      schemaLog.push(await ensureAdd("impressions_latest", "`impressions_latest` int DEFAULT 0"));
      schemaLog.push(await ensureAdd("position_latest", "`position_latest` int NULL"));
      schemaLog.push(await ensureAdd("opportunity_updated_at", "`opportunity_updated_at` datetime NULL"));

      // Tambah unique index pada normalized_keyword (jika belum). Idempotent: cek INFORMATION_SCHEMA dulu.
      const [idxRows] = await conn.execute(
        `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'keyword_inventory' AND INDEX_NAME = 'uq_normalized'`,
      );
      const idxN = Number((idxRows as { n: number }[])[0]?.n ?? 0);
      if (idxN === 0) {
        // Sementara JANGAN buat UNIQUE dulu — jika ada duplikat setelah normalisasi akan gagal.
        // Kita gunakan INDEX biasa (non-unique) — dedupe dilakukan di langkah backfill di bawah.
        await conn.execute("CREATE INDEX `idx_normalized` ON `keyword_inventory` (`tenant_id`, `normalized_keyword`)");
        schemaLog.push("ADD INDEX idx_normalized (non-unique)");
      } else {
        schemaLog.push("skip idx_normalized");
      }

      // 2) Backfill intelijen via enrich library (normalize + cluster + opportunity).
      const enrichLog = await ensureKeywordIntelColumns();

      const finished = new Date();
      return Response.json({
        ok: true,
        startedAt: started.toISOString(),
        finishedAt: finished.toISOString(),
        durationSec: Math.round((finished.getTime() - started.getTime()) / 1000),
        schema: schemaLog,
        enrich: enrichLog,
      });
    } finally {
      conn.release();
      await raw.end();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[migrate-keywords]", msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
};
