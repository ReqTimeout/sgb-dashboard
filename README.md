# sgb-dashboard — Beriklan Dashboard

Beriklan agency + client dashboard (`sgb.beriklan.co.id`).

Stack: Astro 7 SSR (`@astrojs/node` standalone) + Svelte 5 runes + Tailwind 4 + Drizzle ORM + MySQL.
Pola dicopy dari `sariglass-admin` (session auth, middleware CSRF, db pool keepalive).

Deploy: **Coolify VPS, project `agency-beriklan`** — BUKAN Hostinger.
Tracking fase: `docs/WORK-PHASES.md` di repo sariglassbangunan (single source of truth).
Rencana S1–S9: `sgnadmin.md` (DONE 23 Sep 2026).

## Halaman (16)

| Route | Nama | Catatan |
|---|---|---|
| `/` | Pagi ini | Hero + channel strip + copilot + insight naratif |
| `/seo` | Performa SEO | 90 hari GSC + peluang cepat + GBP widget |
| `/ranking` | Ranking Tracker | Movers + TOP3/TOP10 tier |
| `/konten` | Content Pipeline | Funnel 5 stage + ETA antrean |
| `/keywords` | Keyword Inventory | S3: pagination 50/halaman, skor peluang, 9 klaster, dedupe alias, bulk action |
| `/iklan` | Performa Iklan | S7: status chip promo + UTM builder 5 preset + pause-ads modal + audit Meta |
| `/roi` | ROI | Funnel 6 tahap + ROAS explanation |
| `/leads` | Pipeline | Channel otomatis + filter `?promo=` + 1-tap deal |
| `/laporan` | Arsip Laporan | Filter 7/30/90 hari |
| `/radar` | Competitor Radar | Agency only (superadmin) |
| `/ai` | AI Search | Edukasi 3 jalur + sitasi + cron AI |
| `/hq` | HQ | Agency only |
| `/health` | System Health | Agency only + tabel audit_log 20 aktivitas (S8) |
| `/share` | Share Link | Link publik read-only (POST via `/api/share/create`) |
| `/sistem` | Cara Kerja | S4 killer: pipeline 11 tahap live + mode Ikuti 1 artikel |
| `/tracking` | Tracking | S5 killer: 6-hop verify + log viewer auto-refresh + panel Tes Sendiri |

## Alur data (dashboard TIDAK query API eksternal saat render)

Produser (cron `sariglass-admin` + CAPI gateway) push via `X-Ingest-Key` per tenant:

`push-metrics` 05:00 → `daily_metrics`/`rank_snapshots` · `meta-insights` 05:30 · `google-insights` 05:35 ·
`keyword-snapshot` 05:10 → `keyword_inventory` · `daily-report` 06:45 → `daily_reports` ·
CAPI fan-out live → `lead_events` · `ai-citations` manual → `ai_citations`

## Role (S8, guard server-side via `can()`)

- `superadmin` — semua (termasuk /hq /health /radar /pause /bulk).
- `client_admin` — boleh update pipeline + buat share link; TIDAK boleh /hq /health /radar /pause-ads /keywords-bulk.
- `viewer` — read-only murni (semua POST → 403).

Semua aksi tulis → `audit_log` (lihat /health). Ingest key HARUS beda per tenant (`scripts/rotate-key.ts`, dry-run default).

## Dev lokal

```bash
cp .env.example .env   # isi DATABASE_URL lokal
pnpm install
pnpm db:generate       # hasilkan migrasi dari drizzle/schema.ts
pnpm db:migrate        # jalankan migrasi ke MySQL
pnpm db:seed           # seed superadmin + tenant sariglass
pnpm dev               # http://localhost:4323
```

## Deploy Coolify

1. Project `agency-beriklan` → New Resource → Application (dari repo GitHub ini)
   + Database MySQL baru (volume sendiri). Resource limit: app 512MB/0.5 CPU.
2. Set env vars dari `.env.example` di Coolify UI (jangan commit secret).
3. Domain: `sgb.beriklan.co.id` (SSL otomatis via Traefik).
4. JANGAN sentuh resource/project lain di VPS.
