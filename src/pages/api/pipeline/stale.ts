// GET /api/pipeline/stale — D3.4 helper. Public (tidak butuh session) untuk admin cron anomaly.
import { and, eq, sql } from "drizzle-orm";
import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { leadEvents } from "../../../../drizzle/schema";

export const GET: APIRoute = async () => {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - 12 * 3600 * 1000);
    const rows = (await db.execute(sql`
      SELECT status, COUNT(*) n, COALESCE(AVG(1), 0) avg_est
      FROM lead_events
      WHERE status='baru' AND ts < ${cutoff.toISOString().slice(0, 19).replace("T", " ")}
      GROUP BY status
    `)) as { n: number; avg_est: number }[][];
    const flat = (Array.isArray(rows) ? rows[0] : rows) as { n: number }[];
    const stale = flat.reduce((a, r) => a + Number(r.n ?? 0), 0);
    return Response.json({ stale, est: stale * 150000 });
  } catch (e) {
    return Response.json({ stale: 0, est: 0, error: String(e) });
  }
};
