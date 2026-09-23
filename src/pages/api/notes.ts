import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "../../lib/db";
import { notesInternal, tenants } from "../../../drizzle/schema";
import { logAudit } from "../../lib/audit";

// Tambah catatan internal (agency only — middleware sudah pastikan superadmin via halaman /hq,
// tapi endpoint ini validasi role lagi dari session).
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData().catch(() => null);
  const slug = String(form?.get("tenant_slug") ?? "").trim();
  const body = String(form?.get("body") ?? "").trim().slice(0, 2000);
  if (!slug || !body) return redirect("/hq", 302);
  try {
    const db = getDb();
    const t = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
    if (!t[0]) return redirect("/hq", 302);
    const { validateSession, SESSION_COOKIE, can } = await import("../../lib/auth/session");
    const me = await validateSession(cookies.get(SESSION_COOKIE)?.value ?? "");
    if (!me) return new Response("Unauthorized", { status: 401 });
    if (!can(me, "notes.create")) return new Response("Forbidden: hanya agency.", { status: 403 });
    await db.insert(notesInternal).values({ tenantId: t[0].id, author: me.email, body });
    await logAudit({ tenantId: t[0].id, actor: me.email, action: "notes.create", target: `tenant ${slug}` });
  } catch (e) {
    console.error("[notes]", e);
  }
  return redirect("/hq", 302);
};
