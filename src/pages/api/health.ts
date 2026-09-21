import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  return Response.json({ ok: true, app: "sgb-dashboard", time: new Date().toISOString() });
};
