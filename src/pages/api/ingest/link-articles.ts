// /api/ingest/link-articles — terima peta keyword→artikel dari admin.
// Dipanggil push-metrics admin (server-to-server, X-Ingest-Key sama dgn ingest).
// UPDATE-ONLY: hanya baris inventory yang cocok (exact / normalized) yang
// diisi article_slug. TIDAK pernah insert (cegah duplikat), TIDAK ubah status
// (status tetap dikelola manusia; state pipeline tampil via badge live).
import type { APIRoute } from "astro";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { keywordInventory, tenants } from "../../../../drizzle/schema";
import { createHash } from "node:crypto";

const Link = z.object({
  keyword: z.string().min(1).max(255),
  article_slug: z.string().min(1).max(255),
  city: z.string().max(64).nullable().optional(),
  intent: z.string().max(32).nullable().optional(),
  priority: z.number().int().min(0).max(999).nullable().optional(),
});
const Body = z.object({ links: z.array(Link).max(2000), insert_missing: z.boolean().optional().default(false) });

export const POST: APIRoute = async ({ request }) => {
  const key = request.headers.get("X-Ingest-Key") ?? "";
  const hash = createHash("sha256").update(key).digest("hex");
  try {
    const db = getDb();
    const rows = await db.select().from(tenants).where(eq(tenants.ingestKeyHash, hash)).limit(1);
    if (rows.length === 0) return Response.json({ ok: false, error: "bad key" }, { status: 403 });
    const tenantId = rows[0].id;

    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad body" }, { status: 400 });
    }
    let linked = 0, inserted = 0;
    const missing: string[] = [];
    for (const l of parsed.data.links) {
      const norm = l.keyword.toLowerCase().trim();
      const r = await db.execute(sql`
        UPDATE keyword_inventory SET article_slug = ${l.article_slug}, updated_at = NOW()
        WHERE tenant_id = ${tenantId}
          AND NOT (article_slug <=> ${l.article_slug})
          AND (keyword = ${l.keyword} OR normalized_keyword = ${norm})`);
      const affected = Number((r as any).affectedRows ?? 0);
      if (affected > 0) { linked++; continue; }
      // Sudah ter-link slug sama → anggap linked (idempoten).
      const [same] = await db.execute(sql`
        SELECT id FROM keyword_inventory WHERE tenant_id = ${tenantId}
          AND article_slug <=> ${l.article_slug}
          AND (keyword = ${l.keyword} OR normalized_keyword = ${norm}) LIMIT 1`);
      if ((same as any[]).length > 0) { linked++; continue; }
      if (parsed.data.insert_missing) {
        await db.execute(sql`
          INSERT INTO keyword_inventory (tenant_id, keyword, status, article_slug, priority, source, city, intent, normalized_keyword)
          VALUES (${tenantId}, ${l.keyword}, 'antre', ${l.article_slug}, ${l.priority ?? 50}, 'admin-sync', ${l.city ?? null}, ${l.intent ?? null}, ${norm})
          ON DUPLICATE KEY UPDATE article_slug = VALUES(article_slug), updated_at = NOW()`);
        inserted++;
      } else {
        missing.push(l.keyword);
      }
    }
    return Response.json({ ok: true, linked, inserted, missing: missing.slice(0, 20), missingTotal: missing.length });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "error" }, { status: 500 });
  }
};
