// Skema SGB Dashboard — SGB-DASHBOARD-SPEC §3.4 + REPORTING-SYSTEM-SPEC §6.
// Semua tabel operasional punya tenant_id (isolasi di SETIAP query — lihat middleware + tenant.ts).
import {
  boolean,
  datetime,
  double,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const tenants = mysqlTable("tenants", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  domain: varchar("domain", { length: 128 }),
  ingestKeyHash: varchar("ingest_key_hash", { length: 128 }).notNull(),
  configJson: json("config_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dashboardUsers = mysqlTable("dashboard_users", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id"), // null = superadmin (semua tenant)
  email: varchar("email", { length: 190 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["superadmin", "client_admin", "viewer"]).notNull().default("viewer"),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dashboardSessions = mysqlTable("dashboard_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("user_id").notNull(),
  expiresAt: datetime("expires_at").notNull(),
  ip: varchar("ip", { length: 64 }),
  userAgent: varchar("user_agent", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyMetrics = mysqlTable(
  "daily_metrics",
  {
    id: serial("id").primaryKey(),
    tenantId: int("tenant_id").notNull(),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
    channel: varchar("channel", { length: 32 }).notNull(),
    metric: varchar("metric", { length: 64 }).notNull(),
    valueNum: double("value_num"),
    valueJson: json("value_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_metric").on(t.tenantId, t.date, t.channel, t.metric)],
);

export const leadEvents = mysqlTable("lead_events", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  ts: datetime("ts").notNull(),
  type: varchar("type", { length: 32 }).notNull(), // wa_click | form | call
  pageUrl: varchar("page_url", { length: 512 }),
  source: varchar("source", { length: 64 }),
  utmJson: json("utm_json"),
  eventId: varchar("event_id", { length: 64 }),
  phoneHash: varchar("phone_hash", { length: 64 }),
  value: double("value"),
  status: varchar("status", { length: 16 }).notNull().default("baru"), // baru | dibalas | deal | batal
  dealValue: int("deal_value"), // nilai rupiah saat deal
  note: varchar("note", { length: 500 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const competitorWatch = mysqlTable(
  "competitor_watch",
  {
    id: serial("id").primaryKey(),
    tenantId: int("tenant_id").notNull(),
    pageName: varchar("page_name", { length: 255 }).notNull(),
    pageUrl: varchar("page_url", { length: 512 }),
    notes: varchar("notes", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_watch").on(t.tenantId, t.pageName)],
);

export const sharedLinks = mysqlTable("shared_links", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  token: varchar("token", { length: 64 }).notNull(),
  label: varchar("label", { length: 64 }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("uq_token").on(t.token)]);

export const competitorAds = mysqlTable("competitor_ads", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  pageName: varchar("page_name", { length: 255 }).notNull(),
  creativeBody: varchar("creative_body", { length: 2000 }),
  creativeImageUrl: varchar("creative_image_url", { length: 1024 }),
  ctaText: varchar("cta_text", { length: 64 }),
  startDate: varchar("start_date", { length: 16 }),
  platforms: varchar("platforms", { length: 128 }),
  source: varchar("source", { length: 16 }).notNull().default("manual"), // manual | api
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const rankSnapshots = mysqlTable("rank_snapshots", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  keyword: varchar("keyword", { length: 255 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  position: int("position"),
  impressions: int("impressions"),
  clicks: int("clicks"),
  pageUrl: varchar("page_url", { length: 512 }),
});

export const articlesView = mysqlTable("articles_view", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  publishedAt: datetime("published_at"),
  indexedAt: datetime("indexed_at"),
  coverUrl: varchar("cover_url", { length: 512 }),
});

export const tickets = mysqlTable("tickets", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  userId: int("user_id"),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("open"),
  slaDue: datetime("sla_due"),
  repliesJson: json("replies_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reports = mysqlTable("reports", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  periodStart: varchar("period_start", { length: 10 }).notNull(),
  periodEnd: varchar("period_end", { length: 10 }).notNull(),
  kind: varchar("kind", { length: 16 }).notNull(), // weekly | monthly | daily
  pdfPath: varchar("pdf_path", { length: 512 }),
  waSentAt: datetime("wa_sent_at"),
  emailSentAt: datetime("email_sent_at"),
  summaryMd: text("summary_md"),
});

export const dailyReports = mysqlTable("daily_reports", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  reportDate: varchar("report_date", { length: 10 }).notNull(),
  period: varchar("period", { length: 16 }).notNull().default("daily"),
  payloadJson: json("payload_json").notNull(),
  insightsJson: json("insights_json"),
  emailSentAt: datetime("email_sent_at"),
  pushedAt: datetime("pushed_at"),
});

export const aiCitations = mysqlTable("ai_citations", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  checkedAt: datetime("checked_at").notNull(),
  engine: varchar("engine", { length: 32 }).notNull(), // perplexity | chatgpt | gemini
  query: varchar("query", { length: 255 }).notNull(),
  mentioned: boolean("mentioned").notNull().default(false),
  position: int("position"),
  screenshotPath: varchar("screenshot_path", { length: 512 }),
});

export const keywordInventory = mysqlTable(
  "keyword_inventory",
  {
    id: serial("id").primaryKey(),
    tenantId: int("tenant_id").notNull(),
    keyword: varchar("keyword", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("antre"),
    articleSlug: varchar("article_slug", { length: 255 }),
    priority: int("priority").notNull().default(50),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("uq_keyword").on(t.tenantId, t.keyword)],
);

export const notesInternal = mysqlTable("notes_internal", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id").notNull(),
  author: varchar("author", { length: 128 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = mysqlTable("audit_log", {
  id: serial("id").primaryKey(),
  tenantId: int("tenant_id"),
  actor: varchar("actor", { length: 190 }).notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  target: varchar("target", { length: 255 }),
  ts: datetime("ts").notNull(),
});
