// /api/keywords/bulk — bulk action untuk keyword_inventory (superadmin only).
// Action: bump_priority_10 | drop_priority_10 | set_cluster_* | delete.
// Audit log otomatis. CSRF dilindungi middleware (POST harus ada Origin/Referer).
import type { APIRoute } from "astro";
import { inArray } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { keywordInventory } from "../../../../drizzle/schema";
import { validateSession, SESSION_COOKIE, can } from "../../../lib/auth/session";
import { logAudit } from "../../../lib/audit";

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const me = await validateSession(cookies.get(SESSION_COOKIE)?.value ?? "");
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (!can(me, "keywords.bulk")) {
    return new Response("Hanya superadmin yang boleh bulk edit keyword.", { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return new Response("Form tidak valid", { status: 400 });

  const action = String(form.get("action") ?? "");
  const ids = form.getAll("ids[]").map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
  if (!action || ids.length === 0) {
    return new Response("Tidak ada keyword dipilih atau aksi kosong.", { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  let updated = 0;
  let deleted = 0;
  let detail = "";

  try {
    const existing = await db
      .select({ id: keywordInventory.id, keyword: keywordInventory.keyword, priority: keywordInventory.priority, cluster: keywordInventory.cluster })
      .from(keywordInventory)
      .where(inArray(keywordInventory.id, ids));
    const keywordSample = existing.slice(0, 3).map((e) => `"${e.keyword}"`);

    if (action === "bump_priority_10") {
      await db
        .update(keywordInventory)
        .set({ updatedAt: now })
        .where(inArray(keywordInventory.id, ids));
      for (const e of existing) {
        await db
          .update(keywordInventory)
          .set({ priority: (e.priority ?? 50) + 10, updatedAt: now })
          .where((await import("drizzle-orm")).eq(keywordInventory.id, e.id));
        updated++;
      }
      detail = `bump +10 · ${ids.length} baris · sample: ${keywordSample.join(", ")}`;
    } else if (action === "drop_priority_10") {
      for (const e of existing) {
        await db
          .update(keywordInventory)
          .set({ priority: Math.max(0, (e.priority ?? 50) - 10), updatedAt: now })
          .where((await import("drizzle-orm")).eq(keywordInventory.id, e.id));
        updated++;
      }
      detail = `drop −10 · ${ids.length} baris · sample: ${keywordSample.join(", ")}`;
    } else if (action.startsWith("set_cluster_")) {
      const targetCluster = action.replace("set_cluster_", "");
      await db
        .update(keywordInventory)
        .set({ cluster: targetCluster, updatedAt: now, opportunityUpdatedAt: now })
        .where(inArray(keywordInventory.id, ids));
      updated = ids.length;
      detail = `set cluster=${targetCluster} · ${ids.length} baris · sample: ${keywordSample.join(", ")}`;
    } else if (action === "delete") {
      await db.delete(keywordInventory).where(inArray(keywordInventory.id, ids));
      deleted = ids.length;
      detail = `delete · ${ids.length} baris · sample: ${keywordSample.join(", ")}`;
    } else {
      return new Response(`Aksi '${action}' tidak dikenal`, { status: 400 });
    }

    await logAudit({
      tenantId: null, // actions lintas tenant (superadmin) — null aman
      actor: me.email,
      action: `keywords.bulk.${action}`,
      target: `${ids.length} keyword (ids ${ids.slice(0, 5).join(",")}${ids.length > 5 ? "…" : ""})`,
    });
  } catch (e) {
    console.error("[keywords/bulk]", e);
    return new Response("Gagal eksekusi: " + (e instanceof Error ? e.message : String(e)), { status: 500 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/keywords?bulk=${action.split("_")[0]}&n=${Math.max(updated, deleted)}`,
    },
  });
};
