import type { APIRoute } from "astro";
import { generateCopilot } from "../../../lib/ai/copilot";
import { getRequestTenant } from "../../../lib/data";

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user) return new Response("Unauthorized", { status: 401 });
  const tenant = await getRequestTenant(url.host ?? "", "/", new URLSearchParams(), user.role === "superadmin");
  if (!tenant) return new Response("Tenant tidak ditemukan", { status: 404 });
  try {
    const result = await generateCopilot(tenant.id);
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e), actions: [] }, { status: 500 });
  }
};
