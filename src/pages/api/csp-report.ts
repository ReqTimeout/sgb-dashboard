// POST /api/csp-report —collector pelanggaran CSP-Report-Only (phase 1 observasi).
// Publik (browser kirim report tanpa session). Hanya log terstruktur + dedupe,
// tidak menyimpan data sensitif. Tinjau via log Coolify sebelum enforce policy penuh.
import type { APIRoute } from "astro";

const seen = new Set<string>();

export const POST: APIRoute = async ({ request }) => {
  try {
    const ct = request.headers.get("content-type") ?? "";
    const text = (await request.text()).slice(0, 8192);
    const parsed: unknown = JSON.parse(text);
    let reports: Array<Record<string, unknown>> = [];
    if (ct.includes("application/reports+json")) {
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      reports = arr.map((r) => {
        const o = r as Record<string, unknown>;
        return (o.body as Record<string, unknown>) ?? o;
      });
    } else {
      const o = parsed as Record<string, unknown>;
      reports = [(o["csp-report"] as Record<string, unknown>) ?? o];
    }
    for (const r of reports) {
      const directive = String(r["effective-directive"] ?? r["violated-directive"] ?? "?");
      const blocked = String(r["blocked-uri"] ?? r["blockedURI"] ?? "?");
      const doc = String(r["document-uri"] ?? r["documentURI"] ?? "?");
      const key = `${directive}|${blocked}`;
      if (seen.has(key)) continue;
      if (seen.size > 500) seen.clear();
      seen.add(key);
      console.error("[csp-report]", JSON.stringify({ directive, blocked, doc }));
    }
  } catch {
    // payload rusak / bukan JSON — abaikan, tetap 204 agar browser tidak retry.
  }
  return new Response(null, { status: 204 });
};
