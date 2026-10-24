// Konstanta bersama seluruh halaman dashboard — SATU sumber kebenaran.
// Dulu tiap halaman tulis angka sendiri sehingga "hemat dari SEO" berbeda
// antar halaman (Rp1.000 di beranda vs Rp1.500 di /iklan, /seo, /roi).
// Semua pembanding "seandainya beli klik" sekarang pakai nilai yang sama.

/**
 * Estimasi CPC Meta Ads (klik). Dipakai untuk menghitung "nilai" klik organik:
 * berapa biaya kalau klik itu dibeli, bukan dibayar lewat iklan.
 * Referensi: benchmark CPC CTWA Indonesia.
 */
export const CPC_META_RP = 1500;

/** Benchmark CPA per chat Meta CTWA (Indonesia). Di atas ini = perlu dioptimasi. */
export const BENCHMARK_CPA_CHAT_RP = 15000;

/** Lead dianggap "butuh tangani" setelah lebih dari N jam tanpa balasan. */
export const LEAD_STALE_HOURS = 12;

/** Label channel kanonik (dipakai filter + label). */
export const CHANNELS = [
  "Meta Ads",
  "Google Ads",
  "TikTok",
  "Organik",
  "Promo",
  "Langsung",
  "Referral",
] as const;
