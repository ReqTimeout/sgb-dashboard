// Multi-tenant resolver: Host header → tenant row.
// sgb.beriklan.co.id → tenant 'sariglass' · {klien}.beriklan.co.id → tenant lain ·
// path /hq → tenant agency (HQ view Bos). Cache in-memory 60 detik.
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { tenants } from "../../drizzle/schema";

export interface Tenant {
  id: number;
  slug: string;
  name: string;
  domain: string | null;
}

let _cache: { at: number; rows: Tenant[] } | null = null;

async function allTenants(): Promise<Tenant[]> {
  if (_cache && Date.now() - _cache.at < 60_000) return _cache.rows;
  const db = getDb();
  const rows = await db
    .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, domain: tenants.domain })
    .from(tenants);
  _cache = { at: Date.now(), rows };
  return rows;
}

export async function resolveTenant(host: string, pathname: string): Promise<Tenant | null> {
  const rows = await allTenants();
  const h = host.split(":")[0].toLowerCase();
  // 1. cocok domain persis
  const byDomain = rows.find((t) => t.domain && t.domain.toLowerCase() === h);
  if (byDomain) return byDomain;
  // 2. cocok subdomain {slug}.beriklan.co.id
  const m = h.match(/^([a-z0-9-]+)\.beriklan\.co\.id$/);
  if (m) {
    const bySlug = rows.find((t) => t.slug === m[1]);
    if (bySlug) return bySlug;
  }
  // 3. path /hq → tenant agency
  if (pathname === "/hq" || pathname.startsWith("/hq/")) {
    return rows.find((t) => t.slug === "agency") ?? null;
  }
  return null;
}
