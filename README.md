# sgb-dashboard

Beriklan agency + client dashboard (`sgb.beriklan.co.id`).

Stack: Astro 7 SSR (`@astrojs/node` standalone) + Svelte 5 runes + Tailwind 4 + Drizzle ORM + MySQL.
Pola dicopy dari `sariglass-admin` (session auth, middleware CSRF, db pool keepalive).

Deploy: **Coolify VPS, project `agency-beriklan`** — BUKAN Hostinger.
Tracking fase: `docs/WORK-PHASES.md` di repo sariglassbangunan (single source of truth).

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
