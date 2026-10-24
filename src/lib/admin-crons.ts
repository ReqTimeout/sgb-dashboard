// Helper untuk fetch live cron status dari admin endpoint.
// Konsolidasi pattern yang sebelumnya in-line di health.astro, iklan.astro, seo.astro.

export interface LiveCronStatus {
  name: string;
  started_at?: string | null;
  ok: boolean;
  error?: string | null;
  summary?: Record<string, unknown>;
}

export interface CronHealth {
  crons: LiveCronStatus[];
  fetchedAt: number;
  source: "admin" | "cache" | "fallback";
  /** Usia cache dalam detik — kalau > 120, data dianggap basi. */
  staleSec?: number;
}

const TIMEOUT_MS = 25_000;
const CACHE_MS = 60_000;
const MAX_STALE_MS = 30 * 60_000;

let cache: { crons: LiveCronStatus[]; at: number } | null = null;

/**
 * Fetch live cron status dari admin endpoint /api/audit/crons.
 *
 * Penting (perbaikan 24 Okt 2026):
 * 1. Timeout dinaikkan 8s → 25s. Dari Coolify ke Hostinger bisa >8s; sebelumnya
 *    timeout pendek memicu "Admin endpoint down" padahal admin sehat → halaman
 *    /sistem menampilkan "0/11 stage hidup" yang MENIPU (sistemnya sehat).
 * 2. Cache 60 detik supaya 17 halaman tidak menembak admin terus-menerus.
 * 3. Cache TERTUA dipakai sebagai fallback kalau fetch gagal (source="cache")
 *    → tidak pernah tampil "down" kalau kita punya data < 30 menit lalu.
 */
export async function fetchCronHealth(): Promise<CronHealth> {
  const adminUrl = (process.env.ADMIN_URL ?? "https://admin.sariglassbangunan.com").replace(/\/$/, "");
  const token = process.env.ADMIN_CRON_TOKEN ?? "";

  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { crons: cache.crons, fetchedAt: cache.at, source: "admin", staleSec: Math.round((Date.now() - cache.at) / 1000) };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Token lewat HEADER, bukan query string (CWE-598: query string
      // tercatat di access log proxy → credential bocor).
      const r = await fetch(`${adminUrl}/api/audit/crons`, {
        headers: { "X-Admin-Token": token },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (r.ok) {
        const j = await r.json();
        const crons = (j.crons ?? []) as LiveCronStatus[];
        cache = { crons, at: Date.now() };
        return { crons, fetchedAt: Date.now(), source: "admin" };
      }
    } catch {
      /* admin down / timeout — coba lagi */
    }
  }

  // Gagal: pakai cache terakhir kalau masih cukup segar (source="cache").
  if (cache && Date.now() - cache.at < MAX_STALE_MS) {
    return {
      crons: cache.crons,
      fetchedAt: cache.at,
      source: "cache",
      staleSec: Math.round((Date.now() - cache.at) / 1000),
    };
  }
  return { crons: [], fetchedAt: Date.now(), source: "fallback" };
}

/**
 * Lookup apakah cron tertentu sehat. Returns true kalau ada row sukses 24 jam terakhir.
 */
export function isCronHealthy(cron: LiveCronStatus, asOf = Date.now()): boolean {
  if (!cron.started_at) return cron.ok === true;
  const age = asOf - new Date(cron.started_at).getTime();
  // Schema tiap cron beda (30m, 2h, 12h, 6h, dll). Threshold default 4 jam = cukup longgar.
  return cron.ok === true && age < 4 * 3600 * 1000;
}
