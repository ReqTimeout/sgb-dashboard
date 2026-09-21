import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { clearCookieHeader, createSession, sessionCookieHeader, verifyPassword } from "../../../lib/auth/session";
import { dashboardUsers } from "../../../../drizzle/schema";

// Rate limit sederhana: 5 percobaan/menit/IP (memory proses — cukup untuk P0).
const hits = new Map<string, number[]>();

function redirectWithCookie(to: string, cookie: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: to, "Set-Cookie": cookie },
  });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (arr.length >= 5) return new Response("Terlalu banyak percobaan, coba 1 menit lagi.", { status: 429 });
  arr.push(now);
  hits.set(ip, arr);

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  let ok = false;
  try {
    const db = getDb();
    const rows = await db.select().from(dashboardUsers).where(eq(dashboardUsers.email, email)).limit(1);
    const u = rows[0];
    if (u && (await verifyPassword(u.passwordHash, password))) {
      const sid = await createSession(u.id, ip, request.headers.get("user-agent") ?? undefined);
      ok = true;
      const secure = new URL(request.url).protocol === "https:";
      return redirectWithCookie(safeNext, sessionCookieHeader(sid, secure));
    }
  } catch (e) {
    console.error("[login]", e);
  }
  return redirectWithCookie(
    `/login?err=1&next=${encodeURIComponent(safeNext)}`,
    clearCookieHeader(),
  );
};
