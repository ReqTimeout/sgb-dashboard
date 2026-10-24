// /api/health/email-test — proxy tombol "Tes kirim email" di /health.
// Forward ke admin /api/audit/email (POST). Token admin tidak pernah
// keluar dari server dashboard.
import type { APIRoute } from "astro";
import { sendEmailTest } from "../../../lib/admin-crons";

export const POST: APIRoute = async ({ request }) => {
  const user = Astro.locals.user;
  if (!user || user.role !== "superadmin") {
    return Response.json({ ok: false, error: "Khusus agency" }, { status: 403 });
  }
  // Form dari /health dikirim sebagai application/x-www-form-urlencoded,
  // API lain bisa JSON. Terima keduanya.
  let to = "";
  const ctype = request.headers.get("content-type") ?? "";
  try {
    if (ctype.includes("application/json")) {
      const body = (await request.json()) as { to?: string };
      to = (body.to ?? "").trim();
    } else {
      const form = await request.formData();
      to = String(form.get("to") ?? "").trim();
    }
  } catch { /* pakai penerima default dari admin */ }

  const res = await sendEmailTest(to || undefined);

  // Kalau dipanggil dari form browser → kembali ke /health dengan hasil.
  const accept = request.headers.get("accept") ?? "";
  if (!ctype.includes("application/json") && accept.includes("text/html")) {
    const q = new URLSearchParams({
      email_test: res.ok ? "ok" : "gagal",
      email_msg: (res.ok ? `terkirim dari ${res.from ?? "?"}` : res.error ?? "tidak diketahui").slice(0, 200),
    });
    return Response.redirect(new URL(`/health?${q.toString()}`, request.url), 302);
  }
  return Response.json(res, { status: res.ok ? 200 : 502 });
};
