// Matcher: query GSC (apa yang orang ketik di Google) ↔ keyword inventory
// (apa yang kita targetkan). Audit 24 Okt 2026.
//
// Masalah: gsc_stats punya ±280 query riil, tapi hanya 70 yang cocok PERSIS
// dengan keyword_queue ("harga keramik" vs "harga kramik" vs "harga keramik 25x40").
// Kalau dipaksakan exact match, papan peluang hanya seeset data → dashboard
// kelihatan sepi padahal datanya banyak.
//
// Solusi: 3 tingkat fallback
//   1. exact (normalisasi: lowercase + collapse spasi)
//   2. alias  (pakai normalizeKeyword() dari enrich.ts: kramik→keramik, closet→kloset)
//   3. token overlap (≥2 token yang sama, skor ≥0.6 dari token query)
//
// Semua match bersifat READ-ONLY: tidak mengubah data, hanya tampilan.

import { normalizeKeyword } from "./enrich";

/** Kata sambung — diabaikan saat menghitung overlap token. */
const STOPWORDS = new Set([
  "di", "ke", "dari", "yang", "dan", "untuk", "dengan", "pada", "itu", "adalah",
  "serta", "atau", "the", "a", "an", "of", "yaitu", "cara",
]);

export function normText(s: string): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function tokenSet(s: string): Set<string> {
  const out = new Set<string>();
  for (const t of normText(s).split(" ")) {
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}

export interface MatchableKeyword {
  keyword: string;
  normalizedKeyword?: string | null;
  priority: number;
}

export interface KeywordMatcher<T extends MatchableKeyword> {
  (query: string): T | null;
  /** True bila query tidak punya padanan di inventory → celah konten. */
  isGap(query: string): boolean;
}

/**
 * Bangun matcher dari daftar keyword inventory.
 * Preferensi tie-break: skor overlap lebih tinggi → priority lebih tinggi.
 */
export function buildKeywordMatcher<T extends MatchableKeyword>(rows: T[]): KeywordMatcher<T> {
  const byNorm = new Map<string, T>();
  const byAlias = new Map<string, T>();
  const byToken = new Map<string, T[]>();

  for (const r of rows) {
    const n = normText(r.keyword);
    if (n && !byNorm.has(n)) byNorm.set(n, r);
    const a = normalizeKeyword(r.keyword);
    if (a && !byAlias.has(a)) byAlias.set(a, r);
    const rn = r.normalizedKeyword ? normText(r.normalizedKeyword) : "";
    if (rn && !byNorm.has(rn)) byNorm.set(rn, r);
    for (const t of tokenSet(r.keyword)) {
      const arr = byToken.get(t) ?? [];
      arr.push(r);
      byToken.set(t, arr);
    }
  }

  const cache = new Map<string, T | null>();

  const match = (query: string): T | null => {
    const q = normText(query);
    if (!q) return null;
    if (cache.has(q)) return cache.get(q) ?? null;

    let found: T | null =
      byNorm.get(q) ??
      byAlias.get(q) ??
      byAlias.get(normalizeKeyword(q)) ??
      byNorm.get(normalizeKeyword(q)) ??
      null;

    if (!found) {
      const qt = tokenSet(q);
      if (qt.size > 0) {
        let best: { row: T; score: number } | null = null;
        for (const t of qt) {
          for (const r of byToken.get(t) ?? []) {
            const rt = tokenSet(r.keyword);
            let inter = 0;
            for (const x of qt) if (rt.has(x)) inter++;
            const minInter = qt.size === 1 ? 1 : 2;
            if (inter < minInter) continue;
            const score = inter / qt.size;
            if (
              !best ||
              score > best.score ||
              (score === best.score && (r.priority ?? 0) > (best.row.priority ?? 0))
            ) {
              best = { row: r, score };
            }
          }
        }
        if (best && best.score >= 0.6) found = best.row;
      }
    }

    cache.set(q, found);
    return found;
  };

  const wrapped = ((query: string) => match(query)) as KeywordMatcher<T>;
  wrapped.isGap = (query: string) => match(query) === null;
  return wrapped;
}

/**
 * Skor peluang dari data riil GSC.
 * - Zona sweet spot (pos 4-10): impressions × (11 - posisi) → paling tinggi,
 *   karena satu langkah naik dari posisi 10 ke 9 = gain besar dan achievable.
 * - Posisi 1-3: nilai organiknya sudah tinggi, incremental gain kecil.
 * - Di luar halaman 1 (11+): peluang rendah tapi masih relevan.
 * - Tanpa data impressions: fallback ke priority × bobot intent.
 */
export function calcGscOpportunity(opts: {
  impressions: number | null | undefined;
  position: number | null | undefined;
  clicks?: number | null;
  priority?: number;
  intent?: string | null;
}): number {
  const { impressions, position, clicks, priority = 50, intent = null } = opts;
  if (impressions != null && impressions > 0 && position != null && position > 0) {
    if (position >= 4 && position <= 10) return Math.round(impressions * (11 - position));
    if (position <= 3) return Math.round(impressions * 3 + (clicks ?? 0) * 25);
    if (position <= 20) return Math.round(impressions * 1.5);
    return Math.round(impressions * 0.5);
  }
  const w = intent === "transactional" ? 1.5 : intent === "commercial" ? 1.2 : intent === "informational" ? 0.8 : 1;
  return Math.round(priority * w);
}

/** Label zona posisi — dipakai badge & grafik sebaran. */
export function positionZone(pos: number | null | undefined): "top3" | "page1" | "page2" | "far" | "unknown" {
  if (pos == null || pos <= 0) return "unknown";
  if (pos <= 3) return "top3";
  if (pos <= 10) return "page1";
  if (pos <= 20) return "page2";
  return "far";
}

export const ZONE_LABEL: Record<ReturnType<typeof positionZone>, string> = {
  top3: "TOP 1-3",
  page1: "Hal. 1 (4-10)",
  page2: "Hal. 2 (11-20)",
  far: "Hal. 3+ (21+)",
  unknown: "Belum terposisi",
};

export const ZONE_ORDER: ReturnType<typeof positionZone>[] = ["top3", "page1", "page2", "far", "unknown"];
