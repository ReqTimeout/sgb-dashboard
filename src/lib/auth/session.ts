// Session auth Beriklan Dashboard — copy pola sariglass-admin (bcryptjs pure JS,
// tanpa native binding). Role: superadmin (Bos, lintas tenant) + client_admin/viewer.
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { dashboardSessions, dashboardUsers } from "../../../drizzle/schema";

const SALT_ROUNDS = 10; // VPS (bukan shared hosting) → 10 aman
export const SESSION_COOKIE = "sgb_session";
const SESSION_DAYS = 7;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

function randomId(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type UserRole = "superadmin" | "client_admin" | "viewer";

// S8: matriks izin tulis (spec C10). Guard SERVER di setiap endpoint POST —
// jangan cuma hide UI. viewer = read-only murni; client_admin = operasional
// pipeline + share link saja; sisanya superadmin.
export type WriteAction =
  | "pipeline.update"   // tandai deal/dibalas/batal — client_admin boleh
  | "share.create"      // buat share link — client_admin boleh
  | "notes.create"      // catatan internal agency — superadmin saja
  | "radar.watch"       // tambah/hapus pantauan kompetitor — superadmin saja
  | "iklan.action"      // pause ads / log UTM — superadmin saja
  | "keywords.bulk";    // bulk edit keyword — superadmin saja

export function can(user: { role: UserRole } | null | undefined, action: WriteAction): boolean {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.role === "viewer") return false;
  // client_admin: hanya operasional harian
  return action === "pipeline.update" || action === "share.create";
}

export interface SessionUser {
  id: number;
  tenantId: number | null; // null = superadmin (semua tenant)
  email: string;
  name: string;
  role: UserRole;
}

export async function createSession(userId: number, ip?: string, ua?: string): Promise<string> {
  const db = getDb();
  const id = randomId();
  await db.insert(dashboardSessions).values({
    id,
    userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000),
    ip: ip?.slice(0, 64) ?? null,
    userAgent: ua?.slice(0, 255) ?? null,
  });
  return id;
}

export async function validateSession(sessionId: string): Promise<SessionUser | null> {
  if (!sessionId) return null;
  const db = getDb();
  const rows = await db
    .select({ s: dashboardSessions, u: dashboardUsers })
    .from(dashboardSessions)
    .innerJoin(dashboardUsers, eq(dashboardSessions.userId, dashboardUsers.id))
    .where(eq(dashboardSessions.id, sessionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.s.expiresAt.getTime() < Date.now()) {
    await db.delete(dashboardSessions).where(eq(dashboardSessions.id, sessionId));
    return null;
  }
  return {
    id: row.u.id,
    tenantId: row.u.tenantId,
    email: row.u.email,
    name: row.u.name,
    role: row.u.role as UserRole,
  };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await getDb().delete(dashboardSessions).where(eq(dashboardSessions.id, sessionId));
}

export function sessionCookieHeader(sessionId: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 86400}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
