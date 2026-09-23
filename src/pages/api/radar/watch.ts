import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { competitorWatch } from "../../../../drizzle/schema";
import { getRequestTenant } from "../../../lib/data";
import { logAudit } from "../../../lib/audit";

// Kelola watchlist kompetitor (superadmin only).
export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const { validateSession, SESSION_COOKIE, can } = await import("../../../lib/auth/session");
  const me = await validateSession(cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (!can(me, "radar.watch")) return new Response("Forbidden: hanya agency.", { status: 403 });
  const form = await request.formData().catch(() => null);
  const action = String(form?.get("action") ?? "add");
  try {
    const db = getDb();
    const tenant = await getRequestTenant(url.host ?? "", "/radar", new URLSearchParams(), true);
    if (!tenant) return new Response("Tenant tidak ditemukan", { status: 404 });
    if (action === "add") {
      const name = String(form?.get("page_name") ?? "").trim().slice(0, 255);
      if (!name) return redirect("/radar", 302);
      const pageUrl = String(form?.get("page_url") ?? "").trim().slice(0, 512) || null;
      const notes = String(form?.get("notes") ?? "").trim().slice(0, 500) || null;
      await db
        .insert(competitorWatch)
        .values({ tenantId: tenant.id, pageName: name, pageUrl, notes })
        .onDuplicateKeyUpdate({ set: { pageUrl, notes } });
    } else if (action === "del") {
      const id = Number(form?.get("id") ?? 0);
      if (id > 0) await db.delete(competitorWatch).where(and(eq(competitorWatch.id, id), eq(competitorWatch.tenantId, tenant.id)));
    }
    await logAudit({ tenantId: tenant.id, actor: me.email, action: `radar.watch.${action}`, target: action === "add" ? String(form?.get("page_name") ?? "").slice(0, 120) : `id ${form?.get("id")}` });
  } catch (e) {
    console.error("[radar]", e);
  }
  return redirect("/radar", 302);
};
