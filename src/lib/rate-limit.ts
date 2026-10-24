// Rate limit in-memory per kunci (hash token / IP).
//
// Dipakai endpoint ingest yang bisa MENGHAPUS data (replace ranks/articles).
// Tanpa ini, satu ingest key yang bocor bisa dipakai untuk mengosongkan
// seluruh snapshot tenant dalam hitungan detik (CWE-307).
//
// Catatan: ini limiter proses (memory). Cukup untuk satu instance Astro Node
// di Coolify. Kalau nanti multi-replica, ganti ke Redis/Upstash.

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Detik sampai bucket longgar lagi (dipakai header Retry-After). */
  retryAfterSec: number;
}

/**
 * Sliding window counter.
 * @param key    identitas pemanggil (mis. hash ingest key)
 * @param limit  jumlah request yang boleh dalam window
 * @param windowMs durasi window dalam ms
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    const retryAfterSec = Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { allowed: true, remaining: limit - arr.length, retryAfterSec: 0 };
}

/** Bersihkan bucket yang sudah kedaluwarsa (dipanggil sesekali). */
export function pruneRateLimits(now = Date.now(), windowMs = 60_000): void {
  if (buckets.size < 200) return;
  for (const [k, v] of buckets) {
    if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
}
