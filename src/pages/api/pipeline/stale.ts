// GET /api/pipeline/stale — D3.4 helper. Public (tidak butuh session) untuk admin cron anomaly.
import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";

export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    const { sql } = await import("drizzle-orm");
    const cutoff = new Date(Date.now() - 12 * 3600 * 1000);
    const cutoffStr = cutoff.toISOString().slice(0, 19).replace("T", " ");
    const raw = await db.execute(sql`
      SELECT COUNT(*) AS n FROM lead_events
      WHERE status='baru' AND ts < ${cutoffStr}
    `);
    const flat = (Array.isArray(raw) ? raw[0] : raw) as unknown as { n: number | string }[];
    const n = Number(flat[0]?.n ?? 0);
    return Response.json({ stale: n, est: n * 150000 });
  } catch (e) {
    return Response.json({ stale: 0, est: 0, error: String(e) });
  }
};
