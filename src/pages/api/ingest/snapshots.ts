import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { articlesView, rankSnapshots, tenants } from "../../../../drizzle/schema";
import { createHash } from "node:crypto";

// Ingest snapshots: rank keyword harian + snapshot artikel. Idempotent per (tenant, date):
// rank lama tanggal itu dihapus dulu lalu insert baru; articles = full snapshot terbaru.
const Rank = z.object({
  keyword: z.string().max(255),
  position: z.number().nullable().optional(),
  impressions: z.number().nullable().optional(),
  clicks: z.number().nullable().optional(),
  page_url: z.string().max(512).nullable().optional(),
});
const Article = z.object({
  slug: z.string().max(255),
  title: z.string().max(255),
  status: z.string().max(32),
  published_at: z.string().nullable().optional(),
  indexed_at: z.string().nullable().optional(),
  cover_url: z.string().max(512).nullable().optional(),
});
const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ranks: z.array(Rank).max(200).optional(),
  articles: z.array(Article).max(100).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const key = request.headers.get("x-ingest-key") ?? "";
  if (!key) return Response.json({ ok: false, error: "missing key" }, { status: 401 });
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
    const { date, ranks = [], articles = [] } = parsed.data;

    if (ranks.length > 0) {
      await db
        .delete(rankSnapshots)
        .where(and(eq(rankSnapshots.tenantId, tenantId), eq(rankSnapshots.date, date)));
      for (const r of ranks) {
        await db.insert(rankSnapshots).values({
          tenantId,
          keyword: r.keyword,
          date,
          position: r.position == null ? null : Math.round(r.position),
          impressions: r.impressions ?? null,
          clicks: r.clicks ?? null,
          pageUrl: r.page_url ?? null,
        });
      }
    }
    if (articles.length > 0) {
      await db.delete(articlesView).where(eq(articlesView.tenantId, tenantId));
      for (const a of articles) {
        await db.insert(articlesView).values({
          tenantId,
          slug: a.slug,
          title: a.title,
          status: a.status,
          publishedAt: a.published_at ? new Date(a.published_at) : null,
          indexedAt: a.indexed_at ? new Date(a.indexed_at) : null,
          coverUrl: a.cover_url ?? null,
        });
      }
    }
    return Response.json({ ok: true, ranks: ranks.length, articles: articles.length });
  } catch (e) {
    console.error("[ingest/snapshots]", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
};
