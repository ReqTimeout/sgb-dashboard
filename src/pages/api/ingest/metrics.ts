import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { dailyMetrics, tenants } from "../../../../drizzle/schema";

// Ingest API (SGB-DASHBOARD-SPEC §3.3): dashboard TIDAK query API eksternal saat render.
// Produser (cron admin, CAPI gateway, agent) push ke sini. Auth: X-Ingest-Key per tenant.
const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metrics: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        channel: z.string().max(32),
        metric: z.string().max(64),
        value: z.number().nullable().optional(),
        meta: z.record(z.string(), z.unknown()).nullable().optional(),
      }),
    )
    .max(500),
});

export const POST: APIRoute = async ({ request }) => {
  const key = request.headers.get("x-ingest-key") ?? "";
  if (!key) return Response.json({ ok: false, error: "missing key" }, { status: 401 });
  const hash = createHash("sha256").update(key).digest("hex");

  let tenantId: number | null = null;
  try {
    const db = getDb();
    const rows = await db.select().from(tenants).where(eq(tenants.ingestKeyHash, hash)).limit(1);
    if (rows.length === 0) return Response.json({ ok: false, error: "bad key" }, { status: 403 });
    tenantId = rows[0].id;

    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad body", issues: parsed.error.issues }, { status: 400 });
    }
    const { date, metrics } = parsed.data;
    for (const m of metrics) {
      await db
        .insert(dailyMetrics)
        .values({
          tenantId,
          date: m.date ?? date,
          channel: m.channel,
          metric: m.metric,
          valueNum: m.value ?? null,
          valueJson: m.meta ?? null,
        })
        .onDuplicateKeyUpdate({
          set: {
            valueNum: m.value ?? null,
            valueJson: m.meta ?? null,
          },
        });
    }
    return Response.json({ ok: true, stored: metrics.length });
  } catch (e) {
    console.error("[ingest/metrics]", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
};
