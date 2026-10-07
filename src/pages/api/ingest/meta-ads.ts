import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { metaAdDaily, metaAdMapping, tenants } from "../../../../drizzle/schema";

// Ingest Meta Ads Report: 1 baris = 1 iklan x 1 hari (hasil pull producer).
// Auth: X-Ingest-Key per tenant (pola sama seperti /api/ingest/metrics).
const Row = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaign_id: z.string().max(32),
  campaign_name: z.string().max(128).optional().default(""),
  adset_name: z.string().max(128).optional().default(""),
  ad_id: z.string().max(32),
  ad_name: z.string().max(128).optional().default(""),
  owner: z.string().max(8).optional().default("BOS"),
  spend: z.number().optional().default(0),
  impressions: z.number().optional().default(0),
  clicks: z.number().optional().default(0),
  chat_started: z.number().optional().default(0),
  chat_replied: z.number().optional().default(0),
  pixel_lead: z.number().optional().default(0),
  sku: z.string().max(64).nullable().optional(),
  category: z.string().max(32).nullable().optional(),
  mapped: z.boolean().optional().default(false),
});
const Body = z.object({ rows: z.array(Row).max(100) });

export const POST: APIRoute = async ({ request }) => {
  const key = request.headers.get("x-ingest-key") ?? "";
  if (!key) return Response.json({ ok: false, error: "missing key" }, { status: 401 });
  const hash = createHash("sha256").update(key).digest("hex");

  try {
    const db = getDb();
    const tRows = await db.select().from(tenants).where(eq(tenants.ingestKeyHash, hash)).limit(1);
    if (tRows.length === 0) return Response.json({ ok: false, error: "bad key" }, { status: 403 });
    const tenantId = tRows[0].id;

    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad body", issues: parsed.error.issues }, { status: 400 });
    }
    let stored = 0;
    for (const r of parsed.data.rows) {
      await db
        .insert(metaAdDaily)
        .values({
          tenantId,
          date: r.date,
          campaignId: r.campaign_id,
          campaignName: r.campaign_name || null,
          adsetName: r.adset_name || null,
          adId: r.ad_id,
          adName: r.ad_name || null,
          owner: r.owner || "BOS",
          spend: r.spend ?? 0,
          impressions: Math.round(r.impressions ?? 0),
          clicks: Math.round(r.clicks ?? 0),
          chatStarted: r.chat_started ?? 0,
          chatReplied: r.chat_replied ?? 0,
          pixelLead: r.pixel_lead ?? 0,
          sku: r.sku ?? null,
          category: r.category ?? null,
          mapped: r.mapped ?? false,
        })
        .onDuplicateKeyUpdate({
          set: {
            campaignName: r.campaign_name || null,
            adsetName: r.adset_name || null,
            adName: r.ad_name || null,
            owner: r.owner || "BOS",
            spend: r.spend ?? 0,
            impressions: Math.round(r.impressions ?? 0),
            clicks: Math.round(r.clicks ?? 0),
            chatStarted: r.chat_started ?? 0,
            chatReplied: r.chat_replied ?? 0,
            pixelLead: r.pixel_lead ?? 0,
            sku: r.sku ?? null,
            category: r.category ?? null,
            mapped: r.mapped ?? false,
          },
        });
      // Mapping ikut tersimpan bila producer membawa sku/kategori (override manual).
      if (r.sku || r.category) {
        await db
          .insert(metaAdMapping)
          .values({
            tenantId,
            adId: r.ad_id,
            adName: r.ad_name || null,
            sku: r.sku ?? null,
            category: r.category ?? null,
          })
          .onDuplicateKeyUpdate({
            set: { adName: r.ad_name || null, sku: r.sku ?? null, category: r.category ?? null },
          });
      }
      stored++;
    }
    return Response.json({ ok: true, stored });
  } catch (e) {
    console.error("[ingest/meta-ads]", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
};
