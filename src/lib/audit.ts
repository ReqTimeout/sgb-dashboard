// Helper tulis audit_log — dipakai semua API POST.
// Disesuaikan dengan audit_log schema: tenantId (nullable), actor, action, target, ts.
import { getDb } from "./db";
import { auditLog } from "../../drizzle/schema";

export interface AuditEntry {
  tenantId?: number | null;
  actor: string;     // user email atau service cron
  action: string;    // pattern kategori.obyek.aksi, e.g. "pipeline.deal.update"
  target?: string;   // singkat, e.g. "keyword id 123" atau "lead id 456"
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      tenantId: entry.tenantId ?? null,
      actor: entry.actor,
      action: entry.action,
      target: entry.target ?? null,
      ts: new Date(),
    });
  } catch (e) {
    // Audit gagal — log ke console tapi jangan gagalkan operasi utama.
    console.error("[audit]", e instanceof Error ? e.message : String(e));
  }
}
