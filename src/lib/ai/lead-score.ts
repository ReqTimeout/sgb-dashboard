// Lead scoring OTOMATIS — tanpa input manual, tiap lead dapat skor + estimasi nilai.
// Dipakai /leads: sort prioritas, badge HOT, banner "potensi RpX belum ditangani".

export interface ScoredLead {
  score: number; // 0-100
  tier: "HOT" | "WARM" | "COLD";
  estValue: number; // estimasi rupiah dari halaman/produk
  reasons: string[];
}

// Estimasi nilai deal dari URL halaman (harga tipikal material Sari Glass Bangunan)
const VALUE_MAP: [RegExp, number, string][] = [
  [/granit|keramik|marmer/i, 2_000_000, "granit/keramik"],
  [/pintu|kusen|jendela/i, 2_500_000, "pintu/kusen"],
  [/closet|wastafel|shower|sanit/i, 1_500_000, "sanitary"],
  [/cat|nippon|avian|dulux|propan/i, 500_000, "cat"],
  [/semen|bata|hebel|batako|pasir|besi/i, 1_000_000, "bahan dasar"],
  [/lampu|kabel|saklar|stopkontak|electrical/i, 750_000, "electrical"],
  [/promo/i, 1_000_000, "promo"],
];

export function scoreLead(opts: {
  pageUrl: string | null;
  source: string | null;
  ts: string | Date;
  status: string | null;
  /** Berapa kali halaman yang sama diklik WA dalam 7 hari terakhir. */
  repeatCount?: number;
}): ScoredLead {
  const url = (opts.pageUrl ?? "").toLowerCase();
  const src = (opts.source ?? "").toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  // 1. Intent halaman (bobot terbesar)
  if (url.includes("/produk/")) { score += 40; reasons.push("halaman produk"); }
  else if (url.includes("/promo/")) { score += 30; reasons.push("halaman promo"); }
  else if (url.includes("/blog/")) { score += 15; reasons.push("halaman artikel"); }
  else if (url) { score += 20; reasons.push("halaman situs"); }

  // 2. Sumber (paid = niat lebih serius; tapi traffic langsung ke halaman
  //    produk juga niat tinggi — orangnya sudah sampai "tertarik" dan
  //    klik WA sendiri tanpa biaya iklan).
  //    Audit 24 Okt 2026: skoring lama memberi direct cuma +8 sehingga
  //    lead paling ramai (langsung) tidak pernah bisa HOT → badge HOT
  //    selalu 0 dan tidak berguna untuk triage.
  if (src.includes("meta") || src.includes("google") || src.includes("ads") || src.includes("iklan") || src.includes("tiktok")) {
    score += 20; reasons.push("dari iklan");
  } else if (src && src !== "langsung" && src !== "web" && src !== "organik" && src !== "direct") {
    score += 14; reasons.push(`dari ${opts.source}`);
  } else {
    score += 10; reasons.push(src ? `dari ${opts.source}` : "sumber tidak diketahui");
  }

  // 3. Jam (jam toko 08-21 = siap dilayani)
  const h = new Date(opts.ts).getUTCHours() + 7; // WIB approx
  const hh = ((h % 24) + 24) % 24;
  if (hh >= 8 && hh <= 21) { score += 10; reasons.push("jam toko"); }

  // 4. Umur lead (baru = panas)
  const ageH = (Date.now() - new Date(opts.ts).getTime()) / 3_600_000;
  if (ageH < 12) { score += 10; reasons.push("baru <12 jam"); }
  else if (ageH < 48) { score += 5; }

  // 5. Klik berulang pada halaman yang sama = niat tinggi (orang memastikan)
  const repeat = opts.repeatCount ?? 1;
  if (repeat >= 2) {
    score += Math.min(12, (repeat - 1) * 4);
    reasons.push(`klik ulang ${repeat}×`);
  }

  // 6. Status sudah ditangani = turun prioritas
  if (opts.status === "deal" || opts.status === "batal") score = Math.min(score, 20);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = score >= 70 ? "HOT" : score >= 40 ? "WARM" : "COLD";

  let estValue = 500_000;
  for (const [re, v] of VALUE_MAP) {
    if (re.test(url)) { estValue = v; break; }
  }
  return { score, tier, estValue, reasons };
}

export function fmtRpShort(n: number): string {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (n >= 1000) return `Rp${Math.round(n / 1000)}rb`;
  return `Rp${n}`;
}
