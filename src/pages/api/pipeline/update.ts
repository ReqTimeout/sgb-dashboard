import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { leadEvents } from "../../../../drizzle/schema";
import { getRequestTenant } from "../../../lib/data";

// Update status/deal lead pipeline. Auth: session login + tenant match.
const Body = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["baru", "dibalas", "deal", "batal"]),
  deal_value: z.coerce.number().int().min(0).max(999999999).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const { validateSession, SESSION_COOKIE } = await import("../../../lib/auth/session");
  const me = await validateSession(cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!me) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData().catch(() => null);
  const parsed = Body.safeParse({
    id: form?.get("id"),
    status: form?.get("status"),
    deal_value: form?.get("deal_value") ? form.get("deal_value") : null,
    note: form?.get("note") ? String(form.get("note")) : null,
  });
  if (!parsed.success) return new Response("Input tidak valid", { status: 400 });

  try {
    const db = getDb();
    const tenant = await getRequestTenant(url.host ?? "", "/leads", new URLSearchParams(), me.role === "superadmin");
    const rows = await db
      .select()
      .from(leadEvents)
      .where(and(eq(leadEvents.id, parsed.data.id), tenant ? eq(leadEvents.tenantId, tenant.id) : eq(leadEvents.tenantId, -1)))
      .limit(1);
    if (!rows[0]) return new Response("Lead tidak ditemukan", { status: 404 });
    await db
      .update(leadEvents)
      .set({
        status: parsed.data.status,
        dealValue: parsed.data.deal_value ?? (parsed.data.status === "deal" ? rows[0].dealValue : null),
        note: parsed.data.note ?? rows[0].note,
        updatedAt: new Date(),
      })
      .where(eq(leadEvents.id, parsed.data.id));
  } catch (e) {
    console.error("[pipeline]", e);
    return new Response("Gagal menyimpan", { status: 500 });
  }
  return redirect("/leads", 302);
};
