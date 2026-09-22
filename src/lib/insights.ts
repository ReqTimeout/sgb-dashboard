// Penerjemah metrik → bahasa manusia (SGB-DASHBOARD-SPEC §2.3 WOW metrics).
// Rule-based, TANPA AI — deterministik, tidak halusinasi.
export function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export function fmtRp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n) || n === 0) return "Rp0";
  return "Rp" + new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtPct(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(1).replace(".", ",")}%`;
}

export interface Delta {
  dir: "up" | "down" | "flat";
  pct: number | null;
}

export function delta(curr: number, prev: number): Delta {
  if (!prev) return { dir: curr > 0 ? "up" : "flat", pct: null };
  const pct = ((curr - prev) / prev) * 100;
  if (Math.abs(pct) < 1) return { dir: "flat", pct: 0 };
  return { dir: pct > 0 ? "up" : "down", pct };
}

export function deltaBadge(d: Delta): string {
  const arrow = d.dir === "up" ? "▲" : d.dir === "down" ? "▼" : "▬";
  const cls =
    d.dir === "up" ? "bg-emerald-50 text-emerald-700" : d.dir === "down" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500";
  const txt = d.pct == null ? arrow : `${arrow} ${Math.abs(d.pct).toFixed(0)}%`;
  return `<span class="rounded-full px-2 py-0.5 text-xs font-bold ${cls}">${txt}</span>`;
}

export function insightClicks(sum7: number, prev7: number, tenantName: string): string {
  const d = delta(sum7, prev7);
  const who = tenantName;
  if (sum7 === 0) return `${who} belum mendapat klik Google minggu ini — mesin konten sedang mengejar index.`;
  if (d.dir === "up" && d.pct != null && d.pct >= 10)
    return `${fmtInt(sum7)} orang menemukan ${who} di Google minggu ini — naik ${d.pct.toFixed(0)}% dari minggu lalu.`;
  if (d.dir === "down" && d.pct != null && d.pct <= -10)
    return `${fmtInt(sum7)} orang menemukan ${who} di Google minggu ini — turun ${Math.abs(d.pct).toFixed(0)}%. Cek halaman Movers.`;
  return `${fmtInt(sum7)} orang menemukan ${who} di Google minggu ini — stabil.`;
}

export function insightPosition(avg: number | null): string {
  if (avg == null) return "Belum ada data posisi — tunggu snapshot GSC pertama.";
  if (avg <= 3) return `Posisi rata-rata ${avg.toFixed(1)} — zona halaman 1, pertahankan.`;
  if (avg <= 10) return `Posisi rata-rata ${avg.toFixed(1)} — halaman 1, kejar TOP 3.`;
  return `Posisi rata-rata ${avg.toFixed(1)} — masih halaman 2+. Fokus artikel cluster baru.`;
}

export function greet(): string {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}
