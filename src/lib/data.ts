// Query helper dashboard — SEMUA query wajib filter tenant_id (isolasi).
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "./db";
import { articlesView, dailyMetrics, rankSnapshots, tenants } from "../../drizzle/schema";
import type { Tenant } from "./tenant";
import { resolveTenant } from "./tenant";

export async function getRequestTenant(host: string, pathname: string, searchParams: URLSearchParams, isSuperadmin: boolean): Promise<Tenant | null> {
  const t = await resolveTenant(host, pathname);
  if (t) return t;
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
