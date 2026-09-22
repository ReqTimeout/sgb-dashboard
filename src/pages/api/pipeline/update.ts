import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { leadEvents } from "../../../../drizzle/schema";
import { getRequestTenant } from "../../../lib/data";

const META_PIXEL_ID = process.env.META_PIXEL_ID ?? "";
const META_SYS_TOKEN = process.env.META_SYS_TOKEN ?? "";
const META_API = "https://graph.facebook.com/v26.0";

async function sendMetaOfflinePurchase(p: { dealValue: number; phoneHash: string | null; pageUrl: string | null; leadEventId: string | null; ip: string; ua: string }) {
  if (!META_PIXEL_ID || !META_SYS_TOKEN) return { skipped: true };
  const event = {
    event_name: "Purchase",
    event_id: `oc_${p.leadEventId ?? "x"}_${Date.now()}`.slice(0, 64),
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: (p.pageUrl ?? "").slice(0, 512),
    action_source: "other",
    user_data: {
      ...(p.phoneHash ? { ph: [p.phoneHash] } : {}),
      ...(p.ip && p.ip !== "?" ? { client_ip_address: p.ip.slice(0, 64) } : {}),
      client_user_agent: p.ua.slice(0, 256),
    },
    custom_data: { currency: "IDR", value: p.dealValue, content_type: "product" },
  };
  const r = await fetch(`${META_API}/${META_PIXEL_ID}/events?access_token=${META_SYS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [event] }),
  });
  return { http: r.status };
}

const Body = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["baru", "dibalas", "deal", "batal"]),
  deal_value: z.coerce.number().int().min(0).max(999999999).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const { validateSession, SESSION_COOKIE } = await import("../../../lib/auth/session");
  const me = await validateSession(cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!me) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData().catch(() => null);
  const parsed = Body.safeParse({
    id: form?.get("id"),
    status: form?.get("status"),
    deal_value: form?.get("deal_value") ? form.get("deal_value") : null,
    note: form?.get("note") ? String(form.get("note")) : null,
  });
  if (!parsed.success) return new Response("Input tidak valid", { status: 400 });

  try {
    const db = getDb();
    const tenant = await getRequestTenant(url.host ?? "", "/leads", new URLSearchParams(), me.role === "superadmin");
    const rows = await db
      .select()
      .from(leadEvents)
      .where(and(eq(leadEvents.id, parsed.data.id), tenant ? eq(leadEvents.tenantId, tenant.id) : eq(leadEvents.tenantId, -1)))
      .limit(1);
    if (!rows[0]) return new Response("Lead tidak ditemukan", { status: 404 });
    const was = rows[0];
    const newStatus = parsed.data.status;
    const dealValue = parsed.data.deal_value ?? (newStatus === "deal" ? was.dealValue : null);
    await db
      .update(leadEvents)
      .set({
        status: newStatus,
        dealValue,
        note: parsed.data.note ?? was.note,
        updatedAt: new Date(),
      })
      .where(eq(leadEvents.id, parsed.data.id));

    // D2.3 Offline conversion loop — kirim Meta CAPI Purchase kalau lead di-deal.
    // Ini melatih Meta belajar "lead mana yang berkualitas", bukan cuma yang klik.
    if (newStatus === "deal" && dealValue && dealValue > 0) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
      const ua = request.headers.get("user-agent") ?? "";
      sendMetaOfflinePurchase({
        dealValue,
        phoneHash: was.phoneHash ?? null,
        pageUrl: was.pageUrl ?? null,
        leadEventId: was.eventId ?? String(was.id),
        ip,
        ua,
      }).catch((e) => console.error("[pipeline] meta OC:", String(e).slice(0, 200)));
    }
  } catch (e) {
    console.error("[pipeline]", e);
    return new Response("Gagal menyimpan", { status: 500 });
  }
  return redirect("/leads", 302);
};
