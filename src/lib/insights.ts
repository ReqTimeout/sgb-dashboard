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

/**
 * Format rupiah konsisten:
 * - null/NaN/0 → "Rp0" atau "—" sesuai konteks
 * - < Rp100rb → tampil penuh "Rp65.000"
 * - ≥ Rp100rb tapi < Rp1jt → ringkas "Rp100rb" / "Rp245rb"
 * - ≥ Rp1jt → "Rp1,2jt" / "Rp2jt" (1 desimal maksimal)
 * - ≥ Rp1M → "Rp1jt" tanpa desimal
 */
export function fmtRp(n: number | null | undefined, opts: { dashOnZero?: boolean } = {}): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n === 0) return opts.dashOnZero ? "—" : "Rp0";
  if (n < 100_000) return "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n));
  if (n < 1_000_000) return "Rp" + Math.round(n / 1_000) + "rb";
  // jt: 1 desimal Maksimal, no trailing zero
  const jt = n / 1_000_000;
  const trimmed = jt % 1 === 0 ? jt.toFixed(0) : (Math.round(jt * 10) / 10).toString();
  return "Rp" + trimmed.replace(".", ",") + "jt";
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

/**
 * ETA: hitung estimasi bulan habis dari antrean + kecepatan.
 * - queueSize: jumlah item di antrean
 * - ratePer30d: jumlah item yang sudah diproses 30 hari terakhir
 * Return: kalimat manusia Indonesia dengan rencana jelas.
 */
export function etaMonths(queueSize: number, ratePer30d: number): string {
  if (queueSize <= 0) return "Antrean kosong — semua sudah diproses.";
  if (ratePer30d <= 0) return `Antrean ${fmtInt(queueSize)} — kecepatan belum terukur. Minta agent percepat via command "generate batch".`;
  const bulan = queueSize / ratePer30d;
  if (bulan <= 1) return `Antrean ${fmtInt(queueSize)} — habis dalam ${fmtInt(Math.ceil(bulan * 30))} hari pada kecepatan ${fmtInt(ratePer30d)} artikel/bulan.`;
  if (bulan <= 3) return `Antrean ${fmtInt(queueSize)} — habis dalam ±${bulan.toFixed(1)} bulan pada kecepatan saat ini (${fmtInt(ratePer30d)}/bulan). Bisa dipercepat — minta agent generate batch.`;
  return `Antrean ${fmtInt(queueSize)} — butuh ±${Math.ceil(bulan)} bulan pada kecepatan saat ini (${fmtInt(ratePer30d)}/bulan). Pertimbangkan percepat dengan batch atau tambah paralel writer.`;
}

/**
 * formatTanggal: tanggal ISO → "23 Sep 2026" atau "Senin, 23 Sep 2026".
 */
export function formatTanggal(iso: string | Date, withDay = false): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const base = new Intl.DateTimeFormat("id-ID", opts).format(d);
  if (!withDay) return base;
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", ...opts }).format(d);
}

/**
 * formatWaktu: "HH:MM WIB"
 */
export function formatWaktu(iso?: string | Date | null): string {
  const d = iso ? (typeof iso === "string" ? new Date(iso) : iso) : new Date();
  if (isNaN(d.getTime())) return "—";
  const h = String(d.getUTCHours() + 7).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m} WIB`;
}
