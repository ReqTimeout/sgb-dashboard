// GET /api/tracking/log
// Return 20 event terakhir (lead_events) untuk tenant aktif + counter ringkas
// (event hari ini, 7 hari, dedupe rate, last-received age).
// Auth: session (middleware). Tenant scope otomatis.
import type { APIRoute } from "astro";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { leadEvents } from "../../../../drizzle/schema";
import { getRequestTenant } from "../../../lib/data";

export const GET: APIRoute = async ({ locals, url }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });
  const tenant = await getRequestTenant(url.host ?? "", "/tracking", new URLSearchParams(), me.role === "superadmin");
  if (!tenant) return new Response("Tenant not found", { status: 404 });

  const db = getDb();

  // Counters — agregasi dalam 1 query untuk hemat roundtrips.
  const since24h = new Date();
  since24h.setUTCHours(since24h.getUTCHours() - 24);
  const since7d = new Date();
  since7d.setUTCDate(since7d.getUTCDate() - 7);

  const [agg] = await db
    .select({
      totalAll: sql<number>`COUNT(*)`,
      last24h: sql<number>`SUM(CASE WHEN ts >= ${since24h} THEN 1 ELSE 0 END)`,
      last7d: sql<number>`SUM(CASE WHEN ts >= ${since7d} THEN 1 ELSE 0 END)`,
      withEventId: sql<number>`SUM(CASE WHEN event_id IS NOT NULL AND event_id != '' THEN 1 ELSE 0 END)`,
      lastTs: sql<string>`MAX(ts)`,
    })
    .from(leadEvents)
    .where(eq(leadEvents.tenantId, tenant.id));

  const totalAll = Number(agg?.totalAll ?? 0);
  const last24h = Number(agg?.last24h ?? 0);
  const last7d = Number(agg?.last7d ?? 0);
  const withEventId = Number(agg?.withEventId ?? 0);
  const dedupePct = totalAll > 0 ? Math.round((withEventId / totalAll) * 100) : 0;
  const lastTs = agg?.lastTs ? new Date(String(agg.lastTs)).toISOString() : null;

  // 20 event terakhir.
  const rows = await db
    .select({
      id: leadEvents.id,
      ts: leadEvents.ts,
      type: leadEvents.type,
      source: leadEvents.source,
      pageUrl: leadEvents.pageUrl,
      status: leadEvents.status,
      eventId: leadEvents.eventId,
      utmJson: leadEvents.utmJson,
      value: leadEvents.value,
    })
    .from(leadEvents)
    .where(eq(leadEvents.tenantId, tenant.id))
    .orderBy(desc(leadEvents.ts))
    .limit(20);

  // Serialize ts to ISO string list biar JSON response typed.
  const events = rows.map((r) => ({
    id: r.id,
    ts: r.ts ? new Date(String(r.ts)).toISOString() : null,
    type: r.type ?? null,
    source: r.source ?? null,
    pageUrl: r.pageUrl ?? null,
    status: r.status ?? null,
    eventId: r.eventId ?? null,
    utm: (r.utmJson as Record<string, unknown> | null) ?? null,
    value: r.value ?? null,
  }));

  return new Response(
    JSON.stringify({
      ok: true,
      serverTime: new Date().toISOString(),
      counters: { totalAll, last24h, last7d, dedupePct, lastTs },
      events,
    }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
};
