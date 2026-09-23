// S3: keyword intelijen — normalisasi + dedupe + klaster topikal + skor peluang.
// Sumber kebenaran tunggal: rules dipakai oleh /api/cron/migrate-keywords & /api/ingest/snapshots.
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { keywordInventory, rankSnapshots } from "../../../drizzle/schema";

// Daftar 9 hub klaster + regex deteksi sederhana (Bahasa Indonesia, bangunan).
// Bisa di-tune tanpa breaking — lihat CLUSTERS di bawah.
export const CLUSTERS: { id: ClusterId; label: string; regex: RegExp }[] = [
  { id: "cat",       label: "Cat & finishing", regex: /(cat|nippon|avian|dulux|propan|jotun|sampe|nippe|emco|vinilex|wall|finish|dinding|plamir|putty)/i },
  { id: "keramik",   label: "Keramik & granit", regex: /(keramik|granit|marmer|mozaik|lantai keramik|ubin|tegel|kramik)/i },
  { id: "besi",       label: "Besi & baja", regex: /(besi|baja|holo|wf|wide flange|pipa besi|siku|wiremesh|rabuk|rel|np|beton besi|rebar|steel)/i },
  { id: "sanitary",  label: "Sanitary & kamar mandi", regex: /(closet|kloset|wastafel|shower|shower|kran|keran|washtafel|tandon|water heater|waterheater|bidet|urinoir|toilet|kamper|sanitair|sanitary|bath)/i },
  { id: "listrik",   label: "Listrik & kabel", regex: /(listrik|kabel|saklar|stop\s*kontak|steker|lampu|lamp|fitting|panel|mcb|elcb|listrik|electrical|cable)/i },
  { id: "tools",     label: "Tools & mesin", regex: /(bor|drill|gerinda|cutter|gergaji|palu|tang|obeng|impact wrench|tools|alat|mata bor|solder)/i },
  { id: "atap",      label: "Atap & genteng", regex: /(atap|genteng|galvalume|spandek|metal|seng|rangka|truss|kanopi|kuda.?kuda)/i },
  { id: "lantai",    label: "Lantai & dinding", regex: /(lantai|dinding|plester|acian|niveau|waterproofing|keramik 60|granit 80)/i },
  { id: "pipa",      label: "Pipa & fitting", regex: /(pipa|pvc|hdpe|pe|ppr|fitting|lem pipa|seal tape|tba)/i },
];
export type ClusterId = "cat" | "keramik" | "besi" | "sanitary" | "listrik" | "tools" | "atap" | "lantai" | "pipa";

// Alias map — 30+ pasangan umum bahan bangunan. Normalisasi → konsensus.
// Tujuan: "closet duduk" vs "kloset duduk" jadi 1 baris setelah normalize.
export const ALIAS_MAP: Record<string, string> = {
  // Sanitari
  closet: "kloset", kloset: "kloset", wastafel: "wastafel", washtafel: "wastafel",
  "water heater": "waterheater", "water-heater": "waterheater",
  kamper: "kloset", toilet: "kloset", urinoir: "urinoir", bidet: "bidet",
  shower: "shower", keran: "kran", kran: "kran",
  // Cat
  ceat: "cat", nippe: "nippon", vinilex: "cat", vinil: "cat", plamir: "plamir",
  putty: "plamir", propan: "propan", jotun: "jotun",
  // Besi
  besi: "besi", wf: "wf", "wide flange": "wf", holo: "holo", siku: "siku",
  wiremesh: "wiremesh", rebar: "besi", np: "np", steel: "baja", baja: "baja",
  // Keramik
  kramik: "keramik", mozaik: "mozaik", marmer: "marmer", granit: "granit",
  // Listrik
  stopkontak: "stopkontak", "stop kontak": "stopkontak", fitting: "fitting", lamp: "lampu",
  // Tools
  drill: "bor", gerinda: "gerinda", alat: "tools",
  // Konstruksi lainnya
  bata: "bata", batako: "batako", hebel: "hebel", semen: "semen", pasir: "pasir",
  gypsum: "gypsum", gipsum: "gypsum", triplek: "tripleks", triplex: "tripleks",
  paku: "paku", sekrup: "sekrup", baut: "baut",
};

// Intent heuristic (transactional > commercial > informational).
const INTENT_HINTS: { id: string; weight: number; matches: RegExp }[] = [
  { id: "transactional", weight: 1.5, matches: /(harga|beli|jual|order|pesan|shop|buy|price|diskon|promo|ongkir|kirim|termurah|murah|grosir|ukuran|merk)/i },
  { id: "commercial",    weight: 1.2, matches: /(toko|distributor|produsen|pabrik|depot|agen|supplier|cabang|terdekat|jam buka|kontak|lokasi|alamat)/i },
  { id: "informational", weight: 0.8, matches: /(apa itu|cara|how|why|mengapa|tips|kelebihan|kekurangan|review|spesifikasi|ukuran|pasang|install|tutorial)/i },
];

// 24 kecamatan Cilacap (hyperlocal). Lookup substring → kecamatan.
const KECAMATAN_CILACAP = [
  "Majenang", "Cilacap", "Cipari", "Karangpucung", "Sidareja", "Kedungreja",
  "Patimuan", "Gandrungmangu", "Bantarsari", "Jeruklegi", "Kawunganten",
  "Kampung Laut", "Adipala", "Maos", "Sampang", "Binangun", "Nusakambangan",
  "Dayeuhluhur", "Wanareja", "Majenang", "Cigading", "Kesugihan", "Cilacap Selatan", "Cilacap Tengah", "Cilacap Utara",
];

export interface EnrichedKeyword {
  normalizedKeyword: string;
  cluster: ClusterId | null;
  opportunity: number;
  suggestion: string;
  impressionsLatest: number | null;
  positionLatest: number | null;
}

/** Lowercase + apply alias + collapse spaces */
export function normalizeKeyword(input: string): string {
  let k = (input ?? "")
    .toLowerCase()
    .replace(/[‘’'']/g, "'")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Try alias mapping per token
  const tokens = k.split(" ").map((t) => ALIAS_MAP[t] ?? t);
  k = tokens.join(" ");
  // Hapus kata sambung tidak relevan (opsional: hapus "di Majenang" suffix; kita simpan untuk hyperlocal relevance)
  return k.slice(0, 255);
}

/** Deteksi klaster — return id klaster atau null */
export function detectCluster(keyword: string): ClusterId | null {
  for (const c of CLUSTERS) {
    if (c.regex.test(keyword)) return c.id;
  }
  return null;
}

/** Deteksi kota hyperlocal — cek apakah keyword menyebut salah satu kecamatan */
export function detectCity(rawKeyword: string): string | null {
  for (const k of KECAMATAN_CILACAP) {
    if (rawKeyword.toLowerCase().includes(k.toLowerCase())) return k;
  }
  return null;
}

/** Intent — transactional / commercial / informational */
export function detectIntent(keyword: string): "transactional" | "commercial" | "informational" | null {
  for (const h of INTENT_HINTS) {
    if (h.matches.test(keyword)) return h.id as "transactional" | "commercial" | "informational";
  }
  return null;
}

export function intentWeight(intent: string | null): number {
  if (intent === "transactional") return 1.5;
  if (intent === "commercial") return 1.2;
  if (intent === "informational") return 0.8;
  return 1.0;
}

/** Skor peluang dari GSC + fallback heuristik */
export function calcOpportunity(opts: {
  impressions: number | null | undefined;
  position: number | null | undefined;
  priority: number;
  intent: string | null;
  city: string | null;
}): number {
  const { impressions, position, priority, intent, city } = opts;
  // Punya data GSC → sweet spot pos 4-10 di-impressions tinggi
  if (impressions != null && impressions >= 30 && position != null && position >= 4 && position <= 10) {
    return Math.round(impressions * (11 - position));
  }
  // Fallback heuristik
  const base = priority * intentWeight(intent);
  const bonusCity = city && city !== "—" ? 1.3 : 1.0;
  return Math.round(base * bonusCity);
}

/** Kalimat saran manusia — aksi konkret per kondisi keyword */
export function makeSuggestion(opts: {
  status: string;
  opportunity: number;
  position: number | null | undefined;
  impressions: number | null | undefined;
  city: string | null;
}): string {
  const { status, opportunity, position, impressions, city } = opts;
  if (status === "terbit") return "Sudah terbit — fokus internal link + share WA.";
  if (position != null && position >= 4 && position <= 10 && (impressions ?? 0) > 30) {
    return "Tambah FAQ + internal link untuk dorong ke halaman 1";
  }
  if (status === "draft") return "Draft siap terbit — review quality & FAQ schema.";
  if (status === "ter-commit") return "Sudah di-commit (github) — tunggu deploy berikutnya.";
  if (status === "diajukan") return "Sudah submit ke Google Indexing API.";
  // antre / status default
  const hyper = city && city !== "—" ? ` + local CTA ${city}` : "";
  return `Bikin artikel harga${hyper} + tabel harga + CTA WA`;
}

/**
 * Backfill semua keyword: untuk tiap baris, hitung normalized / cluster / opportunity / suggestion.
 * Jalankan via /api/cron/migrate-keywords. Idempotent.
 *
 * @param tenantId opsional — default semua tenant
 */
export async function ensureKeywordIntelColumns(): Promise<{
  scanned: number;
  normalized: number;
  dedupMerged: number;
  enriched: number;
  errors: string[];
}> {
  const log = { scanned: 0, normalized: 0, dedupMerged: 0, enriched: 0, errors: [] as string[] };
  try {
    const db = getDb();
    // Ambil semua keyword (untuk tenant aktif saat migrasi)
    const allRows = await db
      .select({
        id: keywordInventory.id,
        tenantId: keywordInventory.tenantId,
        keyword: keywordInventory.keyword,
        status: keywordInventory.status,
        priority: keywordInventory.priority,
        city: keywordInventory.city,
        intent: keywordInventory.intent,
        articleSlug: keywordInventory.articleSlug,
      })
      .from(keywordInventory);
    log.scanned = allRows.length;
    if (allRows.length === 0) return log;

    // Cari data GSC terbaru untuk keyword dengan rank snapshot.
    const latestRanks = await db
      .select({
        keyword: rankSnapshots.keyword,
        position: rankSnapshots.position,
        impressions: rankSnapshots.impressions,
        clicks: rankSnapshots.clicks,
      })
      .from(rankSnapshots);
    const rankByKw = new Map<string, { position: number | null; impressions: number | null }>();
    for (const r of latestRanks) {
      const cur = rankByKw.get(r.keyword);
      const better = !cur || (r.position != null && (cur.position == null || r.position < cur.position));
      if (better) rankByKw.set(r.keyword, { position: r.position, impressions: r.impressions });
    }

    // Dedup: kelompokkan per (tenant, normalized) — ambil yang ID terkecil (lama) sebagai primary.
    const groups = new Map<string, typeof allRows>();
    for (const r of allRows) {
      const nk = normalizeKeyword(r.keyword);
      const key = `${r.tenantId}::${nk}`;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }

    for (const [, group] of groups) {
      // Sort by id ASC → row[0] = primary (oldest = paling banyak data biasanya).
      group.sort((a, b) => a.id - b.id);
      const primary = group[0];
      const duplicates = group.slice(1);
      const nk = normalizeKeyword(primary.keyword);
      const cluster = detectCluster(primary.keyword);
      const intent = (primary.intent ?? detectIntent(primary.keyword) ?? null) as string | null;
      const city = (primary.city ?? detectCity(primary.keyword) ?? null);
      const rank = rankByKw.get(primary.keyword) ?? null;
      const opp = calcOpportunity({
        impressions: rank?.impressions,
        position: rank?.position,
        priority: primary.priority,
        intent,
        city: city ?? null,
      });
      const sug = makeSuggestion({
        status: primary.status,
        opportunity: opp,
        position: rank?.position,
        impressions: rank?.impressions,
        city: city ?? null,
      });

      // Update primary dengan normalized + cluster + opportunity + city (jika belum ada) + intent (jika belum) + suggestion.
      await db
        .update(keywordInventory)
        .set({
          normalizedKeyword: nk,
          cluster,
          opportunity: opp,
          suggestion: sug,
          city: primary.city ?? city ?? null,
          intent: primary.intent ?? intent ?? null,
          impressionsLatest: rank?.impressions ?? null,
          positionLatest: rank?.position ?? null,
          opportunityUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(keywordInventory.id, primary.id));
      log.enriched++;
      log.normalized++;

      // Merge duplicate ke primary: kalau ada kolom kosong, isi dari duplikat ke primary; lalu hapus duplikat.
      for (const dup of duplicates) {
        // Bandingkan field-bijak — kalau primary.city null tapi dup.city ada, pakai dup.city.
        const patch: Partial<typeof keywordInventory.$inferInsert> = {};
        if (!primary.city && dup.city) patch.city = dup.city;
        if (!primary.intent && dup.intent) patch.intent = dup.intent;
        if (!primary.articleSlug && dup.articleSlug) patch.articleSlug = dup.articleSlug;
        if (primary.priority < dup.priority) patch.priority = dup.priority;
        if (Object.keys(patch).length > 0) {
          await db
            .update(keywordInventory)
            .set({ ...patch, updatedAt: new Date() })
            .where(eq(keywordInventory.id, primary.id));
        }
        await db.delete(keywordInventory).where(eq(keywordInventory.id, dup.id));
        log.dedupMerged++;
      }
    }
  } catch (e) {
    log.errors.push(e instanceof Error ? e.message : String(e));
  }
  return log;
}

/** Heuristic umum untuk suggestion per status (ekspos untuk dipakai di /keywords UI) */
export function suggestForStatus(status: string): string {
  switch (status) {
    case "antre":      return "Antre — belum dibuat artikelnya.";
    case "draft":      return "Draft siap terbit — review quality & FAQ.";
    case "terbit":     return "Sudah terbit — monitor ranking.";
    case "ter-commit": return "Committed (git) — tunggu deploy.";
    case "diajukan":   return "Sudah submit ke Google — tunggu index.";
    default:           return "—";
  }
}
