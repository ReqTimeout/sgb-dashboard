// Query helper dashboard — SEMUA query wajib filter tenant_id (isolasi).
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "./db";
import { articlesView, dailyMetrics, rankSnapshots, tenants } from "../../drizzle/schema";
import type { Tenant } from "./tenant";
import { resolveTenant } from "./tenant";

export async function getRequestTenant(host: string, pathname: string, searchParams: URLSearchParams, isSuperadmin: boolean, tenantIdOverride?: number): Promise<Tenant | null> {
  const t = await resolveTenant(host, pathname);
  if (t) return t;
  if (tenantIdOverride) {
    const db = getDb();
    const rows = await db.select().from(tenants).where(eq(tenants.id, tenantIdOverride)).limit(1);
    if (rows[0]) return { id: rows[0].id, slug: rows[0].slug, name: rows[0].name, domain: rows[0].domain };
  }
  if (isSuperadmin) {
    const slug = searchParams.get("tenant") ?? "sariglass";
    const db = getDb();
    const rows = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (rows[0]) return { id: rows[0].id, slug: rows[0].slug, name: rows[0].name, domain: rows[0].domain };
  }
  return null;
}

export interface Point {
  date: string;
  value: number;
}

export async function series(tenantId: number, channel: string, metric: string, days = 90): Promise<Point[]> {
  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const rows = await db
    .select({ date: dailyMetrics.date, valueNum: dailyMetrics.valueNum })
    .from(dailyMetrics)
    .where(
      and(
        eq(dailyMetrics.tenantId, tenantId),
        eq(dailyMetrics.channel, channel),
        eq(dailyMetrics.metric, metric),
        gte(dailyMetrics.date, since.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(dailyMetrics.date);
  return rows.map((r) => ({ date: r.date, value: r.valueNum ?? 0 }));
}

export function sumRange(pts: Point[], fromDaysAgo: number, toDaysAgo: number): number {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - toDaysAgo);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - fromDaysAgo);
  const s = start.toISOString().slice(0, 10);
  const e = end.toISOString().slice(0, 10);
  return pts.filter((p) => p.date >= s && p.date <= e).reduce((a, p) => a + p.value, 0);
}

export interface ChannelStatus {
  /** Ada baris daily_metrics di channel ini (nilai boleh 0). */
  hasRows: boolean;
  /** Ada spend > 0 di periode. */
  hasSpend: boolean;
  /** Tanggal data terakhir. */
  lastDate: string | null;
  /** Total spend periode. */
  spend: number;
  /** Jumlah hari yang punya baris spend. */
  days: number;
}

/**
 * Status sebuah channel iklan — dipakai supaya dashboard tidak menampilkan
 * channel kosong (Rp0) seolah-olah itu data. Bedakan:
 *   hasRows=false → channel belum pernah kirim data sama sekali (mis. belum ada campaign)
 *   hasRows=true, hasSpend=false → ada campaign tapi belum ada belanja
 */
export async function channelStatus(
  tenantId: number,
  channel: string,
  days = 30,
): Promise<ChannelStatus> {
  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const rows = await db
    .select({ date: dailyMetrics.date, valueNum: dailyMetrics.valueNum })
    .from(dailyMetrics)
    .where(
      and(
        eq(dailyMetrics.tenantId, tenantId),
        eq(dailyMetrics.channel, channel),
        eq(dailyMetrics.metric, "spend"),
        gte(dailyMetrics.date, since.toISOString().slice(0, 10)),
      ),
    );
  const spend = rows.reduce((a, r) => a + (r.valueNum ?? 0), 0);
  return {
    hasRows: rows.length > 0,
    hasSpend: spend > 0,
    lastDate: rows.length ? rows.map((r) => r.date).sort().at(-1) ?? null : null,
    spend,
    days: rows.length,
  };
}

export async function latestMetric(tenantId: number, channel: string, metric: string): Promise<Point | null> {
  const db = getDb();
  const rows = await db
    .select({ date: dailyMetrics.date, valueNum: dailyMetrics.valueNum })
    .from(dailyMetrics)
    .where(and(eq(dailyMetrics.tenantId, tenantId), eq(dailyMetrics.channel, channel), eq(dailyMetrics.metric, metric)))
    .orderBy(desc(dailyMetrics.date))
    .limit(1);
  if (!rows[0]) return null;
  return { date: rows[0].date, value: rows[0].valueNum ?? 0 };
}

export interface RankRow {
  keyword: string;
  position: number | null;
  impressions: number | null;
  clicks: number | null;
  pageUrl: string | null;
  date: string;
}

export interface MetricMeta {
  date: string;
  json: Record<string, unknown>;
}

/** Baca value_json terbaru sebuah (channel, metric) — utk snapshot kategori
 *  (traffic_sources, area_interest) yang produsernya menyimpan map di kolom json. */
export async function latestMetricJson(
  tenantId: number,
  channel: string,
  metric: string,
): Promise<MetricMeta | null> {
  const db = getDb();
  const rows = await db
    .select({ date: dailyMetrics.date, valueJson: dailyMetrics.valueJson })
    .from(dailyMetrics)
    .where(
      and(
        eq(dailyMetrics.tenantId, tenantId),
        eq(dailyMetrics.channel, channel),
        eq(dailyMetrics.metric, metric),
      ),
    )
    .orderBy(desc(dailyMetrics.date))
    .limit(1);
  if (!rows[0]) return null;
  let j: unknown = rows[0].valueJson;
  if (typeof j === "string") {
    try { j = JSON.parse(j); } catch { j = null; }
  }
  if (!j || typeof j !== "object") return { date: rows[0].date, json: {} };
  return { date: rows[0].date, json: j as Record<string, unknown> };
}

export async function latestRanks(tenantId: number, limit = 25): Promise<RankRow[]> {
  const db = getDb();
  const maxDate = await db
    .select({ date: rankSnapshots.date })
    .from(rankSnapshots)
    .where(eq(rankSnapshots.tenantId, tenantId))
    .orderBy(desc(rankSnapshots.date))
    .limit(1);
  if (!maxDate[0]) return [];
  const rows = await db
    .select()
    .from(rankSnapshots)
    .where(and(eq(rankSnapshots.tenantId, tenantId), eq(rankSnapshots.date, maxDate[0].date)))
    .orderBy(desc(rankSnapshots.clicks))
    .limit(limit);
  return rows.map((r) => ({
    keyword: r.keyword,
    position: r.position,
    impressions: r.impressions,
    clicks: r.clicks,
    pageUrl: r.pageUrl,
    date: r.date,
  }));
}

export async function rankHistory(tenantId: number, keyword: string, days = 30): Promise<Point[]> {
  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const rows = await db
    .select({ date: rankSnapshots.date, position: rankSnapshots.position })
    .from(rankSnapshots)
    .where(
      and(
        eq(rankSnapshots.tenantId, tenantId),
        eq(rankSnapshots.keyword, keyword),
        gte(rankSnapshots.date, since.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(rankSnapshots.date);
  return rows.filter((r) => r.position != null).map((r) => ({ date: r.date, value: r.position as number }));
}

export async function recentArticles(tenantId: number, limit = 20) {
  const db = getDb();
  return db.select().from(articlesView).where(eq(articlesView.tenantId, tenantId)).limit(limit);
}

/**
 * Semua snapshot ranking dalam rentang hari — dipakai /ranking untuk
 * menghitung Δ posisi TANPA N+1 query (dulu rankHistory dipanggil per keyword).
 * Audit 24 Okt 2026: 280 keyword × 1 query masing-masing = 280 round-trip
 * ke DB Coolify per render. Sekarang 1 query, semua dihitung di memory.
 */
export interface RankSnap {
  keyword: string;
  date: string;
  position: number | null;
  impressions: number | null;
  clicks: number | null;
  pageUrl: string | null;
}

export async function rankWindow(tenantId: number, days = 8): Promise<RankSnap[]> {
  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  return db
    .select({
      keyword: rankSnapshots.keyword,
      date: rankSnapshots.date,
      position: rankSnapshots.position,
      impressions: rankSnapshots.impressions,
      clicks: rankSnapshots.clicks,
      pageUrl: rankSnapshots.pageUrl,
    })
    .from(rankSnapshots)
    .where(
      and(
        eq(rankSnapshots.tenantId, tenantId),
        gte(rankSnapshots.date, since.toISOString().slice(0, 10)),
      ),
    );
}
