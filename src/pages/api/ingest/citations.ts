import type { APIRoute } from "astro";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { aiCitations, tenants } from "../../../../drizzle/schema";
import { createHash } from "node:crypto";

const Body = z.object({
  engine: z.enum(["perplexity", "chatgpt", "gemini"]),
  query: z.string().min(3).max(255),
  mentioned: z.boolean(),
  position: z.number().int().min(1).nullable().optional(),
});

export const POST: APIRoute = async ({ request }) => {
  const key = request.headers.get("X-Ingest-Key") ?? "";
  if (!key) return Response.json({ ok: false, error: "no key" }, { status: 401 });
  const hash = createHash("sha256").update(key).digest("hex");
  try {
    const db = getDb();
    const rows = await db.select().from(tenants);
    const t = rows.find((r) => r.ingestKeyHash === hash);
    if (!t) return Response.json({ ok: false, error: "bad key" }, { status: 403 });
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) return Response.json({ ok: false, error: "bad body" }, { status: 400 });
    await db.insert(aiCitations).values({
      tenantId: t.id,
      checkedAt: new Date(),
      engine: parsed.data.engine,
      query: parsed.data.query,
      mentioned: parsed.data.mentioned,
      position: parsed.data.position ?? null,
    });
    return Response.json({ ok: true, stored: 1 });
  } catch (e) {
    console.error("[ingest/citations]", e);
    return Response.json({ ok: false, error: "internal" }, { status: 500 });
  }
};
