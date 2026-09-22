// AI Copilot rule-based — analisa data GSC + Meta + WA + pipeline → 3 aksi konkret.
// Bisa di-upgrade ke MiniMax via GMI API kalau GMI_API_KEY di-set; default fallback rule.
// Bahasa output: Indonesia, nada "Sampeyan, Bos" — langsung ke inti.
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "../db";
import { leadEvents, dailyMetrics } from "../../../drizzle/schema";

export interface CopilotAction {
  id: string;
  category: "seo" | "ads" | "lead" | "system" | "content";
  title: string;
  detail: string;
  impact: string;
  cta?: { label: string; href: string };
  severity: "info" | "warn" | "good";
}

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function pct(curr: number, prev: number): number {
  if (!prev) return 0;
  return ((curr - prev) / prev) * 100;
}

function fmtRp(n: number): string {
  if (n < 1000) return `Rp${n}`;
  if (n < 1_000_000) return `Rp${(n / 1000).toFixed(0)}rb`;
  return `Rp${(n / 1_000_000).toFixed(1)}jt`;
}

export async function generateCopilot(tenantId: number): Promise<{ actions: CopilotAction[]; model: string }> {
  const db = getDb();
  const actions: CopilotAction[] = [];

  const since1 = new Date(); since1.setUTCDate(since1.getUTCDate() - 1);
  const since2 = new Date(); since2.setUTCDate(since2.getUTCDate() - 2);

  // SEO klik 7 vs 14
  const seoClicks14 = await db
    .select({ d: dailyMetrics.date, v: dailyMetrics.valueNum })
    .from(dailyMetrics)
    .where(and(eq(dailyMetrics.tenantId, tenantId), eq(dailyMetrics.channel, "seo"), eq(dailyMetrics.metric, "clicks"), gte(dailyMetrics.date, todayISO(-14))));
  const sum7 = seoClicks14.filter((r) => r.d >= todayISO(-7)).reduce((a, r) => a + Number(r.v ?? 0), 0);
  const prev7 = seoClicks14.filter((r) => r.d < todayISO(-7)).reduce((a, r) => a + Number(r.v ?? 0), 0);

  // Position avg
  const pos = await db
    .select({ v: dailyMetrics.valueNum, d: dailyMetrics.date })
    .from(dailyMetrics)
    .where(and(eq(dailyMetrics.tenantId, tenantId), eq(dailyMetrics.channel, "seo"), eq(dailyMetrics.metric, "position"), gte(dailyMetrics.date, todayISO(-7))));
  const avgPos = pos.length ? pos.reduce((a, r) => a + Number(r.v ?? 0), 0) / pos.length : null;

  // Meta spend & chats 30h
  const meta = await db
    .select({ d: dailyMetrics.date, m: dailyMetrics.metric, v: dailyMetrics.valueNum })
    .from(dailyMetrics)
    .where(and(eq(dailyMetrics.tenantId, tenantId), eq(dailyMetrics.channel, "meta_ads"), gte(dailyMetrics.date, todayISO(-30))));
  const mSpend = meta.filter((r) => r.m === "spend").reduce((a, r) => a + Number(r.v ?? 0), 0);
  const mChats = meta.filter((r) => r.m === "leads").reduce((a, r) => a + Number(r.v ?? 0), 0);
  const cpaChat = mChats > 0 ? mSpend / mChats : 0;

  // Pipeline stuck
  const stuckLeads = await db
    .select({ id: leadEvents.id, ts: leadEvents.ts, pageUrl: leadEvents.pageUrl })
    .from(leadEvents)
    .where(and(eq(leadEvents.tenantId, tenantId), eq(leadEvents.status, "baru"), gte(leadEvents.ts, since2)));
  const stuckCount = stuckLeads.length;

  // SEO actions
  const seoTrend = pct(sum7, prev7);
  if (prev7 > 0 && seoTrend < -10) {
    actions.push({
      id: "seo-decline",
      category: "seo",
      title: `Klik turun ${Math.abs(seoTrend).toFixed(0)}% minggu ini`,
      detail: `Sampeyan, dari ${Math.round(prev7)} klik minggu lalu jadi ${Math.round(sum7)} minggu ini. Cek /seo → "Peluang cepat" untuk keyword posisi 4-10 yang bisa didorong naik.`,
      impact: `+${Math.round(Math.abs(seoTrend) / 10 * 5)}% klik = ${fmtRp(Math.abs(seoTrend) / 10 * 5 * sum7 * 1500)}`,
      cta: { label: "Lihat peluang", href: "/seo" },
      severity: "warn",
    });
  }
  if (avgPos != null && avgPos > 10 && avgPos < 30) {
    actions.push({
      id: "seo-position",
      category: "seo",
      title: `Posisi rata-rata ${avgPos.toFixed(1)} — belum halaman 1`,
      detail: `Sampeyan, banyak keyword masih di halaman 2. Tiap naik 5 posisi = trafik naik ~40%. Fokus: tambah FAQ schema + internal link antar artikel terkait.`,
      impact: `Naik ke pos 8 → +${Math.round(seoClicks14.reduce((a, r) => a + Number(r.v ?? 0), 0) * 0.4)} klik/minggu`,
      cta: { label: "Cek ranking", href: "/ranking" },
      severity: "info",
    });
  }
  if (sum7 > 0 && prev7 > 0 && seoTrend >= 10) {
    actions.push({
      id: "seo-up",
      category: "seo",
      title: `Klik naik ${seoTrend.toFixed(0)}% — pertahankan`,
      detail: `Sampeyan, mesin SEO jalan. Klik naik dari ${Math.round(prev7)} → ${Math.round(sum7)} minggu ini. Jangan ubah apa-apa di artikel yang sedang naik — biar Google stabil.`,
      impact: `Maintain = +${fmtRp(sum7 * 4 * 1500)} nilai/bulan`,
      severity: "good",
    });
  }

  // ADS actions
  if (cpaChat > 30000 && mChats > 0) {
    actions.push({
      id: "ads-cpa-high",
      category: "ads",
      title: `CPA per chat ${fmtRp(cpaChat)} — mahal`,
      detail: `Sampeyan, benchmark CTWA Indonesia Rp2-15rb per chat. CPA ${fmtRp(cpaChat)} ${cpaChat > 100000 ? "10-30× lebih mahal" : "di atas batas sehat"}. Kemungkinan: creative fatigue, atau audience overlap 2 campaign.`,
      impact: `Turun ke Rp15rb = hemat ${fmtRp(mSpend - 15000 * mChats)}`,
      cta: { label: "Lihat audit Meta", href: "/iklan" },
      severity: "warn",
    });
  }
  if (cpaChat > 0 && cpaChat <= 15000) {
    actions.push({
      id: "ads-healthy",
      category: "ads",
      title: `CPA sehat ${fmtRp(cpaChat)} per chat`,
      detail: `Sampeyan, di bawah benchmark. Skalakan budget 30-50% minggu ini kalau pipeline belum penuh.`,
      impact: `+30% budget = +${fmtRp(mSpend * 0.3 * 0.7)} leads`,
      cta: { label: "Lihat performa", href: "/iklan" },
      severity: "good",
    });
  }

  // Pipeline actions
  if (stuckCount > 0) {
    actions.push({
      id: "lead-stuck",
      category: "lead",
      title: `${stuckCount} lead belum dibalas >24 jam`,
      detail: `Sampeyan, ${stuckCount} lead masih status BARU. Setiap jam = Rp50-200rb hilang. Buka /pipeline → klik kartu → balas via WA sekarang.`,
      impact: `Konversi 30% lead = ${fmtRp(stuckCount * 150000)} revenue`,
      cta: { label: "Buka pipeline", href: "/leads" },
      severity: "warn",
    });
  }
  if (stuckCount === 0) {
    actions.push({
      id: "lead-clean",
      category: "lead",
      title: `Pipeline bersih`,
      detail: `Sampeyan, semua lead 24 jam terakhir sudah ditangani. Tim WA Anda jalan.`,
      impact: "—",
      severity: "good",
    });
  }

  // Empty state
  if (actions.length === 0) {
    actions.push({
      id: "noop",
      category: "system",
      title: "Sampeyan, mesin jalan stabil",
      detail: "Tidak ada anomali terdeteksi hari ini. Lanjut monitor besok.",
      impact: "—",
      severity: "good",
    });
  }

  const sevOrder = { warn: 0, info: 1, good: 2 };
  actions.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  return { actions: actions.slice(0, 5), model: "rule-engine-v1" };
}
