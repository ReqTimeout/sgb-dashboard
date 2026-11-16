import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE, validateSession } from "./lib/auth/session";

// Publik: login + API auth + ingest (auth via X-Ingest-Key sendiri) + health + cron (auth via ?token sendiri).
// S7: /api/iklan/ SENGAJA tidak publik — action.ts butuh locals.user (session) untuk
// audit_log actor + guard login. (Sebelumnya publik → locals.user selalu null → 401 permanen.)
const PUBLIC_PREFIXES = ["/login", "/api/auth/", "/api/ingest/", "/api/health", "/api/cron/", "/api/pipeline/", "/api/audit/", "/api/copilot/", "/api/csp-report"];

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

// CSP bertahap (AG-08): enforcing minimal = directive yang pasti tidak break
// Astro/Svelte (tanpa script-src/style-src sehingga inline script/style tetap jalan).
// Report-Only = policy penuh target, observasi pelanggaran via /api/csp-report dulu
// sebelum di-enforce (phase 2: ganti unsafe-inline -> nonce, pindah Report-Only -> enforcing).
const CSP_ENFORCE =
  "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; upgrade-insecure-requests";
const CSP_REPORT_ONLY =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://cloudflareinsights.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com; frame-src https://www.googletagmanager.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; report-uri /api/csp-report";

function withSecurityHeaders(res: Response): Response {
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.headers.set("Content-Security-Policy", CSP_ENFORCE);
  res.headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  return res;
}

// A6: path probe/scanner (.env, wp-*, .git, admin.php, ekstensi berbahaya) → 404,
// bukan 302 ke /login (302 mengonfirmasi app ada + membocorkan halaman login).
// Route asli app (/seo, /api/*, /_astro/*, aset) TIDAK cocok → tetap alur normal.
const PROBE_EXT =
  /\.(php|asp|aspx|jsp|cgi|sql|bak|backup|old|orig|swp|swo|tar|tgz|gz|zip|rar|7z|log|ini|conf|cfg|env|git|svn|hg)$/i;
const PROBE_PATH =
  /(^|\/)(wp-login|wp-admin|wp-content|wp-includes|xmlrpc|administrator|phpmyadmin|pma|mysql|actuator|debug|console|server-status|server-info|boaform|HNAP1|cgi-bin|vendor|_profiler|telescope|solr|druid|nacos|composer\.(json|lock)|package\.json|admin\.php)(\/|$)/i;
function isProbe(pathname: string): boolean {
  const p = pathname.toLowerCase();
  if (PROBE_EXT.test(p)) return true;
  if (PROBE_PATH.test(p)) return true;
  // segmen dotfile (.env/.git/.aws/.ssh/.htaccess/.DS_Store) kecuali .well-known
  if (/(^|\/)\.(?!well-known)/.test(p)) return true;
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!csrfOk(context.request)) {
    return withSecurityHeaders(new Response("Forbidden (CSRF)", { status: 403 }));
  }
  const { pathname } = context.url;
  if (isProbe(pathname)) {
    return withSecurityHeaders(new Response("Not Found", { status: 404 }));
  }
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return withSecurityHeaders(await next());
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
    return withSecurityHeaders(context.redirect(`/login?next=${encodeURIComponent(pathname)}`, 302));
  }
  context.locals.user = user;
  return withSecurityHeaders(await next());
});
