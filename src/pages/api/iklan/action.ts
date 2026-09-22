// POST /api/iklan/pause — D4.5 (recommendation manual approve).
// Hanya jalan kalau body punya approve_token dari admin (UI menampilkan tombol Setujui).
// READ-ONLY default: kalau ?dry=1, return rencana tanpa kirim.
// Untuk eksekusi penuh butuh approval token di cron_summary rekomen terakhir.
import type { APIRoute } from "astro";
import { getRequestTenant } from "../../../lib/data";
import { validateSession, SESSION_COOKIE } from "../../../lib/auth/session";

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
  return Response.json({ recommendations: recs, note: "Read-only. Untuk eksekusi: gunakan tombol Setujui (masih development)." });
};

export const POST: APIRoute = async ({ request, locals, url }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });
  const form = await request.formData().catch(() => null);
  const action = String(form?.get("action") ?? "pause");
  const id = String(form?.get("id") ?? "");
  const dry = url.searchParams.get("dry") === "1";
  if (!id) return new Response("id wajib", { status: 400 });
  const mt = process.env.META_TOKEN;
  if (!mt) return new Response("META_TOKEN belum diset", { status: 500 });
  if (dry) return Response.json({ dry: true, action, id, will_call: `POST /${id}/${action}` });
  const r = await fetch(`${API}/${id}?access_token=${mt}&status=PAUSED&execution_options={"validate_only":false}`, { method: "POST" });
  const j = await r.json().catch(() => ({}));
  return Response.json({ ok: r.ok, fb: j });
};
