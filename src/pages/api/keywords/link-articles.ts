// /api/keywords/link-articles — terima peta keyword→artikel dari admin.
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
});
const Body = z.object({ links: z.array(Link).max(2000) });

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
    let linked = 0;
    const missing: string[] = [];
    for (const l of parsed.data.links) {
      const norm = l.keyword.toLowerCase().trim();
      const r = await db.execute(sql`
        UPDATE keyword_inventory SET article_slug = ${l.article_slug}, updated_at = NOW()
        WHERE tenant_id = ${tenantId}
          AND NOT (article_slug <=> ${l.article_slug})
          AND (keyword = ${l.keyword} OR normalized_keyword = ${norm})`);
      const affected = Number((r as any).affectedRows ?? 0);
      if (affected > 0) linked++;
      else missing.push(l.keyword);
    }
    return Response.json({ ok: true, linked, missing: missing.slice(0, 20), missingTotal: missing.length });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "error" }, { status: 500 });
  }
};
