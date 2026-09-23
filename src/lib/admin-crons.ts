// Helper untuk fetch live cron status dari admin endpoint.
// Konsolidasi pattern yang sebelumnya in-line di health.astro, iklan.astro, seo.astro.
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
  source: "admin" | "fallback";
}

/**
 * Fetch live cron status dari admin endpoint /api/audit/crons.
 * Timeout 8 detik — anti-hang kalau admin bermasalah.
 * Kalau gagal → empty array + source "fallback" — halaman tetap render dengan copy explain.
 */
export async function fetchCronHealth(): Promise<CronHealth> {
  const adminUrl = (process.env.ADMIN_URL ?? "https://admin.sariglassbangunan.com").replace(/\/$/, "");
  const token = process.env.ADMIN_CRON_TOKEN ?? "";
  try {
    const r = await fetch(`${adminUrl}/api/audit/crons?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const j = await r.json();
      const crons = (j.crons ?? []) as LiveCronStatus[];
      return { crons, fetchedAt: Date.now(), source: "admin" };
    }
  } catch {
    /* admin down */
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
