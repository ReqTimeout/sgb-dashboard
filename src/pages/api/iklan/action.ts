// POST /api/iklan/action — D4.5 (recommendation manual approve) + S7 (utm_copy log).
// Aksi "pause": butuh META_TOKEN. Kalau ?dry=1, return rencana tanpa kirim.
// Aksi "utm_copy": tanpa META_TOKEN — cuma catat ke audit_log (tahu promo mana niat diiklankan).
// SEMUA eksekusi (dry/real/log) ditulis ke audit_log — S7.
import type { APIRoute } from "astro";
import { getRequestTenant } from "../../../lib/data";
import { logAudit } from "../../../lib/audit";

const ACCOUNT = "act_3386380068089099";
const API = "https://graph.facebook.com/v26.0";

interface RecItem {
  type: "pause_ad" | "increase_budget" | "decrease_budget" | "rotate_creative";
  id: string;
  name: string;
  reason: string;
  metric: string;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });
  // Kembalikan recommendation (sama seperti yang tampil di /iklan panel)
  const tenant = await getRequestTenant(url.host, "/iklan", new URLSearchParams(), me.role === "superadmin");
  if (!tenant) return new Response("Tenant tidak ditemukan", { status: 404 });
  const dashUrl = (process.env.ADMIN_URL ?? "https://admin.sariglassbangunan.com").replace(/\/$/, "");
  const token = process.env.SGB_INGEST_KEY ?? "";
  const a = await fetch(`${dashUrl}/api/audit/crons?token=${token}`).then((r) => r.json()).catch(() => ({}));
  const fatigue = ((a.crons ?? []).find((c: { name: string; summary?: { tired?: unknown } }) => c.name === "creative-fatigue")?.summary?.tired ?? []) as { id: string; name: string; reason: string; spend: number }[];
  const recs: RecItem[] = fatigue.slice(0, 10).map((f) => ({
    type: "rotate_creative",
    id: f.id,
    name: f.name,
    reason: f.reason,
    metric: `spend Rp${Math.round(f.spend).toLocaleString("id-ID")} · ${f.reason}`,
  }));
  return Response.json({ recommendations: recs, note: "Read-only. Untuk eksekusi: tombol 'Jeda iklan ini' di kartu rekomendasi (dry-run dulu, eksekusi butuh META_TOKEN)." });
};

export const POST: APIRoute = async ({ request, locals, url }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });
  const { can } = await import("../../../lib/auth/session");
  if (!can(me, "iklan.action")) return new Response("Forbidden: hanya agency.", { status: 403 });
  const tenant = await getRequestTenant(url.host, "/iklan", new URLSearchParams(), me.role === "superadmin");
  const form = await request.formData().catch(() => null);
  const action = String(form?.get("action") ?? "pause");
  const id = String(form?.get("id") ?? "");
  const dry = url.searchParams.get("dry") === "1";

  // S7: log salinan link UTM — tanpa META_TOKEN, cuma audit.
  if (action === "utm_copy") {
    const slug = String(form?.get("slug") ?? "").slice(0, 120);
    const preset = String(form?.get("preset") ?? "").slice(0, 40);
    if (!slug) return new Response("slug wajib", { status: 400 });
    await logAudit({ tenantId: tenant?.id ?? null, actor: me.email, action: "iklan.utm_copy", target: `promo/${slug} · preset ${preset || "-"}` });
    return Response.json({ ok: true, logged: true });
  }

  if (!id) return new Response("id wajib", { status: 400 });
  const mt = process.env.META_TOKEN;
  if (!mt) return Response.json({ ok: false, error: "META_TOKEN belum diset di server — pakai tombol 'Kirim permintaan ke agency'." }, { status: 500 });
  if (dry) {
    await logAudit({ tenantId: tenant?.id ?? null, actor: me.email, action: "iklan.pause.dry", target: `adset ${id}` });
    return Response.json({ dry: true, action, id, will_call: `POST /${id}/${action}` });
  }
  const r = await fetch(`${API}/${id}?access_token=${mt}&status=PAUSED&execution_options={"validate_only":false}`, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  await logAudit({ tenantId: tenant?.id ?? null, actor: me.email, action: "iklan.pause.real", target: `adset ${id} · fb_ok=${r.ok}` });
  return Response.json({ ok: r.ok, fb: j });
};
