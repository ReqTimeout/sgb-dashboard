// Helper untuk fetch AI-related live data from admin endpoint + STORE public files.
// Konsolidasi pattern fetch untuk /ai page.

export interface AiCronItem {
  name: string;
  ok: boolean;
  error?: string | null;
  summary?: Record<string, unknown>;
  started_at?: string | null;
}

/**
 * Fetch llm-search-ping + ai-citations cron summary dari admin endpoint /api/audit/crons.
 * Return parsed rows untuk 2 cron spesifik. Return null jika gagal.
 */
export async function fetchAiCronSummary(): Promise<{ llm: AiCronItem | null; citations: AiCronItem | null } | null> {
  const adminUrl = (process.env.ADMIN_URL ?? "https://admin.sariglassbangunan.com").replace(/\/$/, "");
  const token = process.env.ADMIN_CRON_TOKEN ?? "";
  try {
    const r = await fetch(`${adminUrl}/api/audit/crons?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const all: AiCronItem[] = j.crons ?? [];
    return {
      llm: all.find((c) => c.name === "llm-search-ping") ?? null,
      citations: all.find((c) => c.name === "ai-citations") ?? null,
    };
  } catch {
    return null;
  }
}

export interface CronInfo {
  name: string;
  schedule: string;
  role: string;
}

export const AI_CRON_SCHEDULE: CronInfo[] = [
  { name: "llm-search-ping",  schedule: "tiap 12 jam",     role: "verify robots + llms.txt + IndexNow" },
  { name: "indexnow",         schedule: "tiap 2 jam",      role: "submit URL baru ke Bing → ChatGPT Search" },
  { name: "gsc-indexing",     schedule: "tiap 30 menit",   role: "submit URL baru ke Google Indexing API" },
  { name: "ai-citations",     schedule: "manual (awal bln)",role: "catat hasil cek sitasi AI" },
];

/**
 * Hitung kapan cek sitasi berikutnya dijadwalkan.
 * Default: hari pertama bulan depan jam 09:00 WIB.
 */
export function nextAiCitationCheck(): Date {
  const now = new Date();
  // First-of-next-month at 09:00 WIB (≈ 02:00 UTC)
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 2, 0, 0));
  return next;
}
