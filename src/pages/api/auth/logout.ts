import type { APIRoute } from "astro";
import { SESSION_COOKIE, clearCookieHeader, invalidateSession } from "../../../lib/auth/session";

async function logout(cookies: { get: (n: string) => { value?: string } | undefined }) {
  const sid = cookies.get(SESSION_COOKIE)?.value;
  try {
    await invalidateSession(sid ?? "");
  } catch (e) {
    console.error("[logout]", e);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: "/login", "Set-Cookie": clearCookieHeader() },
  });
}

export const POST: APIRoute = async ({ cookies }) => logout(cookies);
export const GET: APIRoute = async ({ cookies }) => logout(cookies);
