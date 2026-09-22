import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE, validateSession } from "./lib/auth/session";

// Publik: login + API auth + ingest (auth via X-Ingest-Key sendiri) + health + cron (auth via ?token sendiri).
const PUBLIC_PREFIXES = ["/login", "/api/auth/", "/api/ingest/", "/api/health", "/api/cron/", "/api/pipeline/"];

// CSRF sendiri (pengganti Astro checkOrigin yang dimatikan di astro.config.mjs):
// request non-GET harus punya Origin/Referer cocok APP_URL. Tanpa header (curl/ops) diizinkan.
function csrfOk(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const appUrl = (
    (process.env.APP_URL as string | undefined) ??
    (import.meta.env.APP_URL as string | undefined)
  )?.replace(/\/$/, "");
  if (!appUrl) return true;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  if (!origin && !referer) return true;
  if (origin && origin.replace(/\/$/, "") === appUrl) return true;
  if (referer && referer.startsWith(appUrl + "/")) return true;
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!csrfOk(context.request)) {
    return new Response("Forbidden (CSRF)", { status: 403 });
  }
  const { pathname } = context.url;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return next();
  }
  const sessionId = context.cookies.get(SESSION_COOKIE)?.value;
  let user = null;
  try {
    user = await validateSession(sessionId ?? "");
  } catch (err) {
    // DB down — jangan 500. Treat sebagai belum login → redirect /login.
    console.error("[middleware] validateSession failed:", err);
  }
  if (!user) {
    return context.redirect(`/login?next=${encodeURIComponent(pathname)}`, 302);
  }
  context.locals.user = user;
  return next();
});
