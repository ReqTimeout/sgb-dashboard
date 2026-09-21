import type { APIRoute } from "astro";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { leadEvents, tenants } from "../../../../drizzle/schema";
import { createHash } from "node:crypto";

// Ingest lead events (dari CAPI gateway): wa_click / form / call.
// Idempotent via event_id (dedupe: event yang sama tidak disimpan 2x).
const Ev = z.object({
  ts: z.string().max(32).optional(),
  type: z.string().max(32),
  page_url: z.string().max(512).nullable().optional(),
  source: z.string().max(64).nullable().optional(),
  utm: z.record(z.string(), z.unknown()).nullable().optional(),
  event_id: z.string().max(64).nullable().optional(),
  phone_hash: z.string().max(64).nullable().optional(),
  value: z.number().nullable().optional(),
});
const Body = z.object({ events: z.array(Ev).max(200) });

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
    if (!parsed.success) return Response.json({ ok: false, error: "bad body" }, { status: 400 });

    const ids = parsed.data.events.map((e) => e.event_id).filter((x): x is string => !!x);
    const existing = new Set<string>();
    if (ids.length > 0) {
      const dup = await db
        .select({ eventId: leadEvents.eventId })
        .from(leadEvents)
        .where(inArray(leadEvents.eventId, ids));
      for (const d of dup) if (d.eventId) existing.add(d.eventId);
    }

    let stored = 0;
    for (const e of parsed.data.events) {
      if (e.event_id && existing.has(e.event_id)) continue;
      await db.insert(leadEvents).values({
        tenantId,
        ts: e.ts ? new Date(e.ts) : new Date(),
        type: e.type,
        pageUrl: e.page_url ?? null,
        source: e.source ?? null,
        utmJson: e.utm ?? null,
        eventId: e.event_id ?? null,
        phoneHash: e.phone_hash ?? null,
        value: e.value ?? null,
      });
      stored++;
    }
    return Response.json({ ok: true, stored });
  } catch (e) {
    console.error("[ingest/events]", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
};
