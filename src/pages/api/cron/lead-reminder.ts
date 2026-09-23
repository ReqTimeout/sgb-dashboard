// /api/cron/lead-reminder — D3.3 Opsi B: email ke Bos/toko kalau ada lead BARU >24 jam belum dibalas.
// Auth: ?token=$CRON_TOKEN (env dashboard). Cron Hostinger: 07:00 WIB harian.
import type { APIRoute } from "astro";
import { and, eq, lt } from "drizzle-orm";
import nodemailer from "nodemailer";
import { getDb } from "../../../lib/db";
import { leadEvents, tenants } from "../../../../drizzle/schema";

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token");
  if (!token || token !== process.env.CRON_TOKEN) {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }
  try {
    const need = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "REPORT_TO_EMAIL"];
    for (const k of need) if (!process.env[k]) throw new Error(`${k} belum diset di env dashboard`);
    const db = getDb();
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
    const stale = await db
      .select({ id: leadEvents.id, tenantId: leadEvents.tenantId, ts: leadEvents.ts, pageUrl: leadEvents.pageUrl, source: leadEvents.source })
      .from(leadEvents)
      .where(and(eq(leadEvents.status, "baru"), lt(leadEvents.ts, cutoff)))
      .limit(50);
    if (stale.length === 0) return Response.json({ ok: true, stale: 0, sent: false });

    // Kelompokkan per tenant
    const byTenant = new Map<number, typeof stale>();
    for (const s of stale) {
      const arr = byTenant.get(s.tenantId) ?? [];
      arr.push(s);
      byTenant.set(s.tenantId, arr);
    }
    const names = new Map<number, string>();
    for (const tid of byTenant.keys()) {
      const t = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
      names.set(tid, t[0]?.name ?? `Tenant ${tid}`);
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: process.env.SMTP_SECURE !== "0",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const to = (process.env.REPORT_TO_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    let blocks = "";
    for (const [tid, arr] of byTenant) {
      const lis = arr
        .map((s) => {
          const page = (s.pageUrl ?? "(langsung)").replace("https://sariglassbangunan.com", "") || "/";
          const jam = new Date(String(s.ts)).toISOString().slice(0, 16).replace("T", " ");
          return `<li>${page} — ${jam} WIB · sumber: ${s.source ?? "langsung"}</li>`;
        })
        .join("");
      blocks += `<h3 style="margin:12px 0 4px">${names.get(tid)} — ${arr.length} lead perlu follow-up</h3><ul>${lis}</ul>`;
    }
    await transporter.sendMail({
      from: process.env.REPORT_FROM ?? process.env.SMTP_USER,
      to,
      subject: `${stale.length} lead belum dibalas >24 jam — Beriklan Pipeline`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#DC2626">⏰ Lead perlu follow-up</h2><p>${stale.length} lead masih berstatus BARU lebih dari 24 jam. Segera balas via WhatsApp — lead dingin = uang hilang.</p>${blocks}<p><a href="https://sgb.beriklan.co.id/leads" style="display:inline-block;background:#FACC15;color:#1C1917;font-weight:bold;padding:10px 20px;border-radius:8px;text-decoration:none">Buka Pipeline →</a></p><p style="color:#888;font-size:12px">Otomatis 07:00 WIB · Beriklan Agency</p></div>`,
    });
    return Response.json({ ok: true, stale: stale.length, sent: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
};
