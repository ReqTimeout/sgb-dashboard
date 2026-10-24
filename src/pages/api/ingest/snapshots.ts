import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { articlesView, keywordInventory, rankSnapshots, tenants } from "../../../../drizzle/schema";
import { createHash } from "node:crypto";
import { rateLimit, pruneRateLimits } from "../../../lib/rate-limit";
import { logAudit } from "../../../lib/audit";

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
const Keyword = z.object({
  keyword: z.string().max(255),
  status: z.string().max(32),
  article_slug: z.string().max(255).nullable().optional(),
  priority: z.number().nullable().optional(),
  source: z.string().max(64).nullable().optional(),
  city: z.string().max(64).nullable().optional(),
  intent: z.string().max(32).nullable().optional(),
});
// Batas dinaikkan 24 Okt 2026 (audit SGB):
//  - ranks 200 → 1000: push-metrics mengirim SEMUA query GSC 30 hari (±280) +
//    page + queue-rank. Sebelumnya 200 → payload >200 kena zod 400 → SELURUH
//    snapshot push hilang (dan karena log tak ada, tak ada yang curiga).
//  - articles 100 → 1000: kirim SEMUA artikel published (208), bukan cuma
//    24 jam terakhir (max 20).
//  - keywords 500 → 1000: antrean keyword 1.413 dipecah jadi chunk 200.
const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ranks: z.array(Rank).max(1000).optional(),
  articles: z.array(Article).max(1000).optional(),
  keywords: z.array(Keyword).max(1000).optional(),
  // Flag replace_*: saat payload dipecah jadi beberapa request, hanya chunk
  // pertama yang boleh mengosongkan tabel. Tanpa ini, chunk kedua menghapus
  // hasil chunk pertama.
  //
  // Keamanan (CWE-307): replace_ranks MENGHAPUS seluruh baris rank milik
  // (tenant, date) — scope kecil, default true supaya idempoten.
  // replace_articles MENGHAPUS SELURUH baris artikel milik tenant — scope
  // besar → default FALSE, harus diminta eksplisit.
  replace_ranks: z.boolean().optional(),
  replace_articles: z.boolean().optional(),
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

    // Rate limit per kunci ingest. Endpoint ini bisa menghapus data, jadi
    // kunci yang bocor tidak boleh bisa menghapus semua snapshot dalam
    // hitungan detik (CWE-307). Batas 240 request/menit: cron push-metrics
    // mengirim ranks dalam chunk 300 + antrean keyword dalam chunk 200
    // (±10 request per siklus), jadi masih jauh di bawah batas.
    const rl = rateLimit(`ingest:${hash}`, 240, 60_000);
    if (!rl.allowed) {
      return Response.json(
        { ok: false, error: "rate limited" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
    pruneRateLimits();

    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad body" }, { status: 400 });
    }
    const { date, ranks = [], articles = [], keywords = [] } = parsed.data;
    // replace_ranks default true (scope tenant+date, butuh idempoten).
    // replace_articles default FALSE (hapus SELURUH artikel tenant) — harus
    // diminta eksplisit supaya request tak sengaja tidak mengosongkan tabel.
    const replaceRanks = parsed.data.replace_ranks !== false;
    const replaceArticles = parsed.data.replace_articles === true;
    let kwCount = 0;
    if (keywords.length > 0) {
      for (const k of keywords) {
        await db
          .insert(keywordInventory)
          .values({
            tenantId,
            keyword: k.keyword,
            status: k.status,
            articleSlug: k.article_slug ?? null,
            priority: k.priority ?? 50,
            source: k.source ?? null,
            city: k.city ?? null,
            intent: k.intent ?? null,
          })
          .onDuplicateKeyUpdate({
            set: {
              status: k.status,
              articleSlug: k.article_slug ?? null,
              priority: k.priority ?? 50,
              source: k.source ?? null,
              city: k.city ?? null,
              intent: k.intent ?? null,
            },
          });
        kwCount++;
      }
    }

    if (ranks.length > 0) {
      if (replaceRanks) {
        await db
          .delete(rankSnapshots)
          .where(and(eq(rankSnapshots.tenantId, tenantId), eq(rankSnapshots.date, date)));
        // Jejak audit setiap penghapusan (CWE-307: tidak boleh ada delete
        // tanpa jejak siapa/kapan/berapa).
        await logAudit({
          tenantId,
          actor: "ingest:snapshots",
          action: "ingest.snapshots.replace_ranks",
          target: `date=${date} rows=${ranks.length}`,
        });
      }
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
      if (replaceArticles) {
        await db.delete(articlesView).where(eq(articlesView.tenantId, tenantId));
        await logAudit({
          tenantId,
          actor: "ingest:snapshots",
          action: "ingest.snapshots.replace_articles",
          target: `rows=${articles.length}`,
        });
      }
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
    return Response.json({ ok: true, ranks: ranks.length, articles: articles.length, keywords: kwCount });
  } catch (e) {
    console.error("[ingest/snapshots]", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
};
