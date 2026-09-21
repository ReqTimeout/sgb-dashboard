import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { dailyReports, tenants } from "../../../../drizzle/schema";
import { createHash } from "node:crypto";

// Ingest memory laporan (dari cron daily-report admin): payload angka + insights.
// Idempotent per (tenant, report_date, period) — upsert.
const Body = z.object({
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.string().max(16).default("daily"),
  payload: z.record(z.string(), z.unknown()),
  insights: z.record(z.string(), z.unknown()).nullable().optional(),
  email_sent_at: z.string().nullable().optional(),
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
    if (!parsed.success) return Response.json({ ok: false, error: "bad body" }, { status: 400 });
    const b = parsed.data;

    const existing = await db
      .select({ id: dailyReports.id })
      .from(dailyReports)
      .where(
        and(
          eq(dailyReports.tenantId, tenantId),
          eq(dailyReports.reportDate, b.report_date),
          eq(dailyReports.period, b.period),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(dailyReports)
        .set({
          payloadJson: b.payload,
          insightsJson: b.insights ?? null,
          emailSentAt: b.email_sent_at ? new Date(b.email_sent_at) : null,
          pushedAt: new Date(),
        })
        .where(eq(dailyReports.id, existing[0].id));
      return Response.json({ ok: true, updated: true });
    }
    await db.insert(dailyReports).values({
      tenantId,
      reportDate: b.report_date,
      period: b.period,
      payloadJson: b.payload,
      insightsJson: b.insights ?? null,
      emailSentAt: b.email_sent_at ? new Date(b.email_sent_at) : null,
      pushedAt: new Date(),
    });
    return Response.json({ ok: true, stored: true });
  } catch (e) {
    console.error("[ingest/reports]", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
};
