import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";
import { getDb } from "../../../lib/db";
import { sharedLinks } from "../../../../drizzle/schema";
import { getRequestTenant } from "../../../lib/data";
import { logAudit } from "../../../lib/audit";
import { can } from "../../../lib/auth/session";

// POST /api/share/create — buat share link publik (dipindah dari share.astro:
// Astro tidak menjalankan handler POST di file .astro yang juga me-render
// halaman — request jatuh ke render GET. Endpoint .ts selalu jalan.)
export const POST: APIRoute = async ({ request, locals, url }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (!can(me, "share.create")) return new Response("Forbidden: role Anda read-only.", { status: 403 });
  const t = await getRequestTenant(url.host, "/share", new URLSearchParams(), me.role === "superadmin");
  if (!t) return new Response("Tenant tidak ditemukan", { status: 404 });
  const form = await request.formData().catch(() => null);
  if (!form) return new Response("Form tidak valid", { status: 400 });
  const db = getDb();
  const token = randomBytes(18).toString("hex").slice(0, 32);
  const label = String(form.get("label") ?? "Laporan publik").slice(0, 64) || "Laporan publik";
  const days = Math.min(90, Math.max(1, Number(form.get("days") ?? 30)));
  await db.insert(sharedLinks).values({
    tenantId: t.id, token, label,
    expiresAt: new Date(Date.now() + days * 86400000),
  });
  await logAudit({ tenantId: t.id, actor: me.email, action: "share.create", target: `"${label}" · ${days} hari` });
  return new Response(null, { status: 302, headers: { Location: `/share?msg=created&token=${token}` } });
};
