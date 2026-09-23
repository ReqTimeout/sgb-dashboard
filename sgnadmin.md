# sgnadmin.md — Rencana Kerja Upgrade SGB Dashboard (S1–S9)

> **Master plan upgrade `sgb.beriklan.co.id`** — hasil audit live + code-level 23 Sep 2026.
> Repo: `sgb-dashboard` (Astro 7 SSR + Svelte 5 + Tailwind 4 + Drizzle MySQL, deploy Coolify VPS project `agency-beriklan`).
> Gaya dokumen mengikuti `adminwork.md` (sariglass-admin): per phase detail, file yang disentuh, DoD, bukti QA.
> **Status: DRAFT v1 — review Bos sebelum eksekusi.**

---

## 0. RINGKASAN AUDIT (fakta terverifikasi live, 23 Sep 2026)

### 0.1 Yang sehat ✅

| Cek | Hasil |
|---|---|
| Login superadmin (rate-limit 5/min, session 7 hari, cookie HttpOnly SameSite=Lax) | ✅ 302 → `/` |
| 14 halaman (`/ /seo /ranking /konten /keywords /iklan /roi /leads /laporan /radar /ai /hq /health /share`) | ✅ semua HTTP 200 |
| ⌘K command palette, theme toggle dark/light | ✅ ada |
| Ingest 5 endpoint (metrics/events/snapshots/reports/citations) | ✅ auth X-Ingest-Key sha256 |
| CAPI gateway `capi.beriklan.co.id/healthz` | ✅ `{ok:true}` |
| Promo landing toko publik (3 slug: besi-8/kia-kloset/keramik-40) | ✅ semua 200 |
| `llms.txt` (25KB, 83 artikel), robots.txt allow 13 AI crawler | ✅ live |
| Cron fleet 16 job (push-metrics 05:00 WIB … health-check tiap 1h) | ✅ terjadwal semua |
| Data riil mengalir: GSC 14 klik/7h · 754 tayang · Meta 5.383 klik/342 chat/Rp2,2jt spend 30h · 83 artikel · 1.373 keyword | ✅ |

### 0.2 Bug & masalah (urut prioritas)

**A. Merusak kepercayaan user (→ S1):**
1. `/leads` — hero "2 prospek · potensi **Rp0**" tapi kartu channel Langsung "≈**Rp500rb**" dan antrean "deal **Rp0** ≈Rp500rb". Tiga angka berbeda di satu layar. Sumber: hero pakai `deal_value` (0), kartu channel pakai `estValue` dari `scoreLead()`.
2. `/roi` — funnel "Deal 1 → Revenue **Rp0**": deal tercatat tapi `deal_value` tidak terisi. Kode auto-fill estValue ADA di `/api/pipeline/update` tapi kalah oleh `deal_value=0` eksplisit dari form (kondisi falsy check lolos). ROAS tampil "—" tanpa penjelasan kenapa.
3. **Definisi "prospek" beda antar halaman** — `/roi` = 342 (chat_started Meta CTWA, tidak lewat website) vs `/leads` = 2 (beacon situs). Tidak ada label sumber → user bingung.
4. Homepage copilot — insight "Lead WA jalan terus." + body "Belum ada lead WA —" (kontradiksi). `insights.ts` tidak guard kasus leads=0.
5. `/leads` — verdict chip "Bagus" untuk Meta Ads padahal 0 prospek di pipeline (verdict hanya lihat CPA dari Meta insights).

**B. UX & copywriting (→ S2):**
6. Emoji di UI: 📈🎯📝 (homepage deep-link), 🏷️🛰️⚙️🔍 (/iklan), 👋 (login), 📧 (/laporan), ⏰ (email lead-reminder) — melanggar DNA sendiri ("pakai icon SVG").
7. Angka tanpa penjelasan sumber — user tidak tahu "14 klik" itu dari GSC jam 05:00. Perlu tooltip "dari mana angka ini".
8. `/konten` — antre 1.284 vs terbit 83 tanpa ETA ("berapa lama antrean habis?").
9. `/iklan` — "CPA per bales Rp442,5 rb" jujur tapi tanpa konteks & tanpa CTA ke lead yang belum dibalas.
10. Empty state "menunggu OAuth" / "menunggu akses Meta" / citations kosong — tanpa estimasi waktu & tanpa aksi yang bisa dilakukan user sekarang.
11. `/laporan` — preview insight terpotong, tanpa filter periode.
12. Bell notifikasi di header — dekoratif murni (alertCount selalu 0, tanpa dropdown).

**C. Performa & skala (→ S3):**
13. `/keywords` — **636KB HTML, 1.000 baris tanpa pagination**. Kolom Kota 100% "—". Duplikat ejaan (closet/kloset) tidak dinormalisasi. Priority 90 flat untuk semua `xls-longtail`. Tanpa bulk action, tanpa skor peluang.

**D. Fitur belum jadi / unused (→ S6–S8):**
14. `/api/iklan/action` POST pause — self-declared "masih development", tidak di-wire UI.
15. Role `client_admin` vs `viewer` — tidak pernah dibedakan di kode (viewer dekoratif). Client login bisa lihat semua tombol tulis.
16. Tabel `audit_log`, `tickets`, `reports` — unused (spec §7 minta audit_log di semua write).
17. Metric `ai/referrals_7d` — tidak ada producer (GA4 collector belum dibangun; padahal beacon store sudah kirim `traffic_source`).
18. `competitor_ads` — tidak ada writer (menunggu akses Meta Ad Library API).
19. GBP widget — "menunggu OAuth" (Bos belum authorize).
20. Seed: tenant `agency` & `sariglass` pakai **ingest key hash SAMA** (melanggar learning rev-13 "key harus beda per tenant").
21. Nama produk placeholder "SGB Dashboard" di beberapa tempat.
22. Login rate-limit in-memory (reset tiap redeploy) — acceptable P0, dicatat.
23. `/api/pipeline/stale` publik tanpa filter tenant (by design untuk cron anomaly — tapi hitung SEMUA tenant; risiko bocor antar-klien saat multi-tenant aktif).

### 0.3 Jawaban "kenapa ada promo landing di dashboard?"

**Bukan bug.** Kartu "🏷️ Promo aktif — landing siap diiklankan" di `/iklan` (task D6.5, commit `d6ac421`) = daftar landing promo **di toko publik** (`sariglassbangunan.com/promo/{slug}`) yang siap jadi tujuan iklan Meta/Google. Dashboard TIDAK punya landing promo sendiri. **Masalahnya hanya label** — dikira halaman promo di dalam dashboard. Fix copy + perkaya di S7.

---

## 1. JAWABAN 7 PERTANYAAN BOS (ringkas — detail di phase)

| # | Pertanyaan | Jawaban | Phase |
|---|---|---|---|
| 1 | Deep dive metrik/chart/copy per halaman | 5 bug trust + 7 isu UX (§0.2). Chart layerchart sehat (hydrate client:visible ✅, tooltip ✅) tapi format angka & konteks belum konsisten | S1+S2 |
| 2 | Semua fitur berjalan? | 14/14 halaman ✅, form deal/notes/radar/share ✅. Rusak/kosong: bell, pause ads, role viewer, audit_log, AI referrals | S1+S7+S8 |
| 3 | Keyword bisa improve? | BANYAK: kota kosong semua, duplikat ejaan, tanpa skor peluang, tanpa pagination, priority flat, tanpa klaster | S3 |
| 4 | Halaman flow sistem (artikel→publish→indexer) | BELUM ADA → bikin `/sistem`: pipeline animasi 11 node live + mode "Ikuti 1 artikel" | **S4 ⭐** |
| 5 | Visualisasi tracking | Panel kecil di /iklan → upgrade halaman `/tracking`: diagram 6 hop + log viewer live + panel "Tes sendiri" | **S5 ⭐** |
| 6 | AI/LLM dikirim tiap hari ke semua AI? | **Jujur: TIDAK — dan tidak ada yang bisa.** ChatGPT/Perplexity/Claude tidak punya API submit. AI belajar via 3 jalur: (1) crawler bots mereka (13 UA di-allow robots.txt), (2) Bing index via IndexNow tiap 2 jam (ChatGPT Search baca dari Bing), (3) llms.txt 25KB. Cron `llm-search-ping` verify ketiganya tiap 12 jam. Sitasi = cek manual bulanan 5 query × 3 engine. User check di `/ai` — tapi halaman belum MENJELASKAN ini | S6 |
| 7 | Killer features per phase sangat detail | Dokumen ini | S0 ✅ |

---

## 2. PHASE DETAIL

> **Urutan eksekusi: S1 → S2 → S4 → S5 → S3 → S6 → S7 → S8 → S9.**
> Alasan: bug trust duluan (merusak kredibilitas di mata client), lalu 2 killer page (S4/S5 = alasan user buka dashboard tiap hari), lalu yang berat data (S3), sisanya polish.
> Tiap phase: `pnpm check` 0 error + `pnpm build` sukses + commit granular + push (Coolify auto-deploy) + screenshot bukti + update WORK-PHASES (repo sariglassbangunan = single source of truth).

---

### S1 — Bug Integritas Data (trust) 🔴 prioritas 1

**Goal:** semua angka konsisten antar halaman; tidak ada lagi "potensi Rp0" di sebelah "≈Rp500rb"; tidak ada insight yang kontradiksi dengan datanya sendiri.

**Task:**
1. **Satukan valuasi lead.** Sumber kebenaran tunggal = `scoreLead().estValue`.
   - `src/pages/leads.astro`: hero "potensi" = Σ estValue lead non-batal (bukan Σ deal_value). Kartu channel pakai rumus sama. Antrean: jika `deal_value=0` tampilkan estValue dengan prefix "≈ (estimasi)".
   - `src/pages/api/pipeline/update.ts`: jika status=deal dan `deal_value` falsy ATAU `Number(deal_value)===0` → auto-fill dari estValue (kode sudah ada; bug-nya form kirim `0` eksplisit yang lolos check falsy-string `"0"`).
2. **Label sumber di setiap angka besar.** Chip kecil di bawah StatCard/funnel step: "Meta Ads · 05:30 WIB" / "Beacon situs · real-time" / "GSC · 05:00 WIB" / "Manual pipeline".
   - `/roi`: "342 prospek" → "342 chat WA dari iklan (Meta)". `/leads`: "2 lead dari situs (beacon)".
   - Tambah 1 kalimat penjelas hero /roi: "Chat dari iklan masuk langsung ke WA CS — tidak melewati website. Pipeline /leads = yang klik dari situs."
3. **Copilot guard leads=0** di `src/lib/ai/copilot.ts` + `src/lib/insights.ts`: jika lead 14h = 0 → judul "Lead WA belum masuk" + body "Mesin siap: beacon aktif, CAPI sehat. Setiap klik Order WA di situs langsung muncul di sini." — JANGAN pernah klaim "jalan terus" kalau kosong.
4. **Verdict channel**: chip `Bagus/Pantau/Mahal` hanya jika prospek ≥ 1; selain itu chip abu "Belum ada data".
5. **ROAS "—"** → "Menunggu deal pertama bernilai" + link "Catat di pipeline → /leads".

**File:** `src/pages/leads.astro`, `roi.astro`, `index.astro`, `iklan.astro` (minor), `src/lib/ai/copilot.ts`, `src/lib/insights.ts`, `src/pages/api/pipeline/update.ts`.
**DoD:**
- Screenshot /leads + /roi: semua angka valuasi konsisten (hero = Σ kartu channel).
- Tes nyata: tandai 1 lead jadi deal tanpa isi nilai → deal_value otomatis estValue → /roi Revenue terisi.
- Tidak ada insight kontradiktif (cek dengan data leads=0 dan leads>0).

**Estimasi:** 1 sesi kerja.

---

### S2 — UX & Copywriting 14 Halaman 🔴 prioritas 2 — ✅ DONE rev 94 (23 Sep 2026, f121ccc + 4422c16)

**Goal:** setiap halaman bisa dipahami Bos/client awam tanpa penjelasan lisan; **zero emoji UI**; setiap angka punya konteks sumber.

**Yang sudah live (commit `f121ccc`+`4422c16`):**

1. **`Icon.astro` BARU** — 30 SVG monoline monokrom stroke 1.5px, paket flat. Dipakai konsisten di 11 halaman + `CopilotWidget`. 0 dependency.
2. **Zero emoji UI** — `\p{Emoji_Presentation}` = 0 di 15 halaman live (login 👋, /iklan 🛰/⚙/🔍/🏷/💡, /seo 🎯, /ai 📄/🤖/🔍/👥, /laporan 📧, /index 📈/🎯/📝, /radar ✕, lead-reminder subject ⏰, /iklan Google Ads ⛔ — semua ganti Icon).
3. **`EmptyState.astro` redesign** — pola 3-baris (apa · kapan · aksi sekarang). Tambah mascot pose `clock`/`doc`. CTA opsional dengan icon external-link.
4. **`StatCard` prop `source=` baru** — tooltip "dari mana angka ini" hover/focus a11y keyboard. Wired di 13 StatCard (`/seo`, `/ranking`, `/iklan`, `/roi`, `/index`, `/share`).
5. **`/konten` ETA card** — "Antrean 1.373 butuh ±69 bulan pada kecepatan 20/bulan". Bisa batch via `gen batch`. Hitung dari `articlesView` count.
6. **`/laporan` filter periode** 7/30/90 hari (URL param). Preview insight jadi `line-clamp-2`. Empty state pakai pola baru.
7. **`/iklan` konteks CPA bales** — kartu "Balas chat cepat naikkan konversi" muncul bila reply rate < 20% dengan CTA ke `/leads`.
8. **`/ai`** — tambah jadwal cek sitasi otomatis: "Cek berikutnya dijadwalkan 1 Okt 2026".
9. **`/ranking`** — chip TOP N tanpa emoji (text only).
10. **Format rupiah konsisten** (`insights.ts fmtRp`) — `<100rb` tampil penuh `Rp65.000`; `≥100rb` compact `Rp245rb`; `≥1jt` tanpa trailing zero `Rp1jt`, dengan desimal `Rp1,2jt`.
11. **lead-reminder email subject** hapus ⏰.
12. **Pola hero Hero Hero sudah pakai InfoHint chip** (S1 + S2) — setiap angka besar punya link "sumber data".

**File disentuh:** `src/components/{Icon,EmptyState,StatCard,InfoHint,CopilotWidget}.astro` + 11 halaman + `src/lib/insights.ts`.

**DoD:**
- ✅ Live emoji 0 di 15 halaman (live curl verify).
- ✅ `pnpm check` 0 error.
- ✅ `pnpm build` 5.5s OK.
- ✅ Screenshot bukti `/tmp/opencode/sgb-s2/` (34 PNG desktop+mobile × 11 halaman).
- ⏳ pw-vision mobile audit leftover P2 — menyusul via S9 (tidak blocker; tidak ada perubahan mobile layout baru yang mengganggu).

**Estimasi actual:** 1 sesi (lebih cepat dari estimasi 1–2 sesi).

---

### S3 — Keyword Intelligence `/keywords` 🟡 — ✅ DONE rev 95 (23 Sep 2026, 1ae4567 + 3d1c44c)

**Goal:** dari tabel dump 1.000 baris → mesin keputusan: keyword mana yang dikerjakan berikutnya dan kenapa.

**Kondisi data AWAL (live 23 Sep):** 1.373 keyword — 1.284 antre, 67 ter-commit, 22 diajukan. Sumber: `xls-longtail` (priority 90 flat, kota "—", intent transactional) + `gsc` harvester.

**Yang sudah live (commit `1ae4567`+`3d1c44c`):**

1. **DB schema baru** — migration `0005_keyword_intel.sql` (drizzle-generated), tapi endpoint `/api/cron/migrate-keywords` cek INFORMATION_SCHEMA dulu → idempotent (running kedua kali semua "skip X").
   Kolom baru: `normalized_keyword`, `cluster`, `opportunity`, `suggestion`, `impressions_latest`, `position_latest`, `opportunity_updated_at`, `idx_normalized` (non-unique — UNIQUE ditahan karena ada banyak duplikat eksisting).
2. **Library `src/lib/keywords/enrich.ts`:**
   - 9 `CLUSTERS` regex (cat, keramik, besi, sanitary, listrik, tools, atap, lantai, pipa)
   - 30+ `ALIAS_MAP` (closet→kloset, ceat→cat, water heater→waterheater, kamper→kloset, dll)
   - 24 `KECAMATAN_CILACAP` (Majenang/Cilacap/Cipari/.../Cilacap Utara)
   - 3 `INTENT_HINTS` (transactional×1.5 / commercial×1.2 / informational×0.8)
   - `calcOpportunity` (GSC pos4-10 × impressions ATAU priority × intent × city_bonus×1.3)
   - `makeSuggestion` (kalimat manusia per kondisi)
   - `ensureKeywordIntelColumns()` — bulk backfill + dedupe merge
3. **`/keywords` rewrite** — pagination 50/halaman, filter chip (status / klaster / kota / q), sort (opportunity / priority / updated / keyword), bar peluang mini per row, kolom kota auto-populate, kolom Aksi disarankan.
   - **Ukuran HTML 93KB** (vs 636KB sebelumnya = **-85%**) ✅ target DoD.
   - 1.373 keyword dinormalisasi + enriched ✅
   - Kota fill-rate ~80% (semua keyword "toko bangunan {kecamatan}" sekarang punya kota).
4. **Bulk action** — `POST /api/keywords/bulk` (superadmin only via session+role check) dengan CSRF middleware + audit_log via helper `src/lib/audit.ts`.
   Aksi: `bump_priority_10` / `drop_priority_10` / `set_cluster_{keramik,atap,tools}` / `delete`.
   Tested live: bump priority pada keyword id 187 → redirect ke `/keywords?bulk=bump&n=1` ✅, priority 90 → 100.
5. **Live counts (first enrichment)**: scanned=1.373 / normalized=1.373 / dedupMerged=0 (alias applied tapi tidak ada duplicate exact setelah truncate) / enriched=1.373.
6. **Idempotent** — running `migrate-keywords` kedua kali semua "skip X" tanpa ALTER, errors array kosong.
7. **Bulk action tested**: bumps priority, redirects dengan `bulk=bump&n=1`.

**File disentuh:** `drizzle/{schema.ts, migrations/0005_keyword_intel.sql, meta/_journal.json, meta/0005_keyword_intel.json}`, `src/lib/keywords/enrich.ts` (326 baris), `src/lib/audit.ts`, `src/pages/keywords.astro` (rewrite), `src/pages/api/cron/migrate-keywords.ts`, `src/pages/api/keywords/bulk.ts`.

**DoD achieved:**
- ✅ /keywords HTML 93KB < target 100KB (-85% dari 636KB sebelumnya).
- ✅ Pagination 28 halaman @ 50 baris.
- ✅ Sort peluang default DESC.
- ✅ Bulk action tested.
- ✅ Migrasi idempotent (running kedua = semua skip).
- ✅ 0 emoji UI (lolos S2).
- ⚠️  Cluster distribution belum test (data `toko bangunan {kecamatan}` tidak match cluster regex — by design, itu keyword toko bukan produk). Cluster valid untuk keyword yang mengandung "keramik/granit/besi/cat/dll".
- ⏳ Dedupe: 0 duplikat eksak ditemukan (data unik per kata, tapi alias_map puny 30+ pair siap untuk keyword baru).

**Estimasi actual:** 1 sesi (lebih cepat dari estimasi 2 sesi).

---

### S4 — ⭐ `/sistem` — Cara Kerja Mesin (KILLER PAGE) 🟢 — ✅ DONE rev 96 (23 Sep 2026, 80562ef)

**Goal:** user MELIHAT mesin bekerja 24/7 dengan mata kepala sendiri → ketergantungan. "Saya tidak perlu tanya agency lagi — saya lihat sendiri semuanya jalan."

**Konsep:** pipeline animasi 11 node — vertikal di mobile, horizontal/natural di desktop. Tiap node = tahap nyata dengan angka live, bukan ilustrasi kosong.

```
[01 Keyword antre 1.284] → [02 Draft generator] → [03 Review admin] → [04 Terbit 83 artikel]
→ [05 Sitemap ping 06:30] → [06 IndexNow→Bing] → [07 Google Indexing]
→ [08 Ranking tracker] → [09 Klik→Customer] → [10 Lead WA real-time] → [11 Laporan pagi 06:45]
```

**Yang sudah live (commit `80562ef`):**

1. **`src/components/PipelineNode.astro` BARU** — kartu node monoline, status dot warna (live=green pulse / idle=slate / pending=yellow / error=red), hover lift+shadow, focus ring kuning a11y. CSS `@keyframes node-pulse` scale 1→1.35 + ring fade (2.4s loop).
2. **`<ol>` timeline list** dengan connector SVG vertikal (mobile) + horizontal (desktop) — via CSS dan pseudo-elements.
3. **`src/lib/admin-crons.ts` BARU** — `fetchCronHealth()` + `isCronHealthy()`. Konsolidasi pattern fetch /api/audit/crons yang sebelumnya in-line di health/iklan/seo.astro. Timeout 8 detik, fallback ke empty array + label "admin endpoint down" bila gagal.
4. **Tepat 11 stage (template-driven `stages: Stage[]` array):**
   - 01 Keyword antre → 02 Draft generator → 03 Review admin → 04 Terbit publish
   - 05 Sitemap ping → 06 IndexNow→Bing → 07 Google Indexing API
   - 08 Ranking tracker → 09 Klik→Customer → 10 Lead WA real-time → 11 Laporan pagi
5. **Status live dari cron health** — tiap stage punya `cronName` yang lookup ke `cronByName.get(name)?.ok`; tampilkan "Menunggu" kalau cron down. Logika: hijau `live` = cron ok <4 jam + schedule valid. Hero chip: "**3/11 stage hidup**" live dinamis.
6. **Kartu "Semalam · mesin kerjakan"** — 4 metrik: URL di-submit ke Google (cron gsc-indexing), artikel live, crawl OK/error, email pagi terkirim.
7. **Mode "Ikuti 1 artikel"** (`?article=slug`) — dropdown 40 artikel live (articles_view) → timeline 8 stage per-artikel dengan tanggal nyata dari DB (`publishedAt`/`indexedAt`). Hijau = selesai, abu = proses. Bukan dropdown+dummy — bisa pilih artikel apa pun.
8. **Lib CSS-NATIVE saja** — 0 dep motion. Keyframes: `node-pulse`, `connector-draw`, `packet-fly`, `flow-pulse`. Reduced-motion override tetap aktif.
9. **Sidebar nav** — grup "Sistem" += link "Cara Kerja" (icon rocket) untuk semua role. /hq & /health tetap superadmin-only.

**File disentuh:** `src/{pages/sistem.astro, components/PipelineNode.astro, components/Sidebar.astro, lib/admin-crons.ts}`, `src/styles/global.css` (keyframes).

**DoD achieved (live curl + screenshot):**
- ✅ `/sistem` HTTP 200, 69KB HTML, 11 node live (`data-stage="1"` s/d `"11"`).
- ✅ Hero "3/11 stage hidup" rendered dinamis dari cron health real.
- ✅ Mode Ikuti Artikel — timeline 8 stage dengan publishedAt/indexedAt nyata dari DB.
- ✅ Sidebar nav link "Cara Kerja" aktif.
- ✅ 0 emoji UI (lolos S2 — Icon monoline).
- ✅ `pnpm check` 0 error (21 hint pre-existing).
- ✅ `pnpm build` 5.83s OK.
- ✅ Screenshot `/tmp/opencode/sgb-s4/` (4 PNG: desktop pipeline viewport+full, article journey, mobile).

**Estimasi actual:** 1 sesi (lebih cepat dari estimasi 2 sesi).

---

### S5 — ⭐ `/tracking` — Visualisasi Tracking Live (KILLER PAGE) 🟢 — ✅ DONE rev 97 (23 Sep 2026, b856a72)

**Goal:** user bisa TES SENDIRI tracking-nya jalan: klik WA di toko → lihat event muncul di dashboard < 10 detik. Trust maksimal, tanpa perlu percaya kata-kata agency.

**Yang sudah live (commit `b856a72`):**

1. **API `GET /api/tracking/log`** (BARU) — JSON endpoint, session+tenant-scoped, `Cache-Control: no-store`. Returns `{ counters, events[20] }`. Single SQL with conditional aggregation.
2. **`/tracking.astro`** (BARU) — hero dark gradient + 3 chip status + counter strip 4 (Hari ini/7hari/Dedupe/Terakhir) + 6-hop diagram + log viewer 20 + Panel "Tes sendiri" + ringkasan teknis.
3. **`TrackingFlow.astro`** (BARU) — komponen dengan inline `<script is:inline vanilla JS>`. Prefill dari SSR `serverSideData` prop, lalu auto-refresh via `setInterval(30s)` + `visibilitychange` pause saat tab tersembunyi. Baris baru di-highlight kuning 3.5 detik (animate via DOM mutate + ring).
4. **6-hop diagram live verify** — tiap hop kartu mini dengan status dot warna (hijau/merah) + URL endpoint + note "live/M HTTP X/down":
   - 01 Tombol WA (sariglassbangunan.com/produk/...)
   - 02 Beacon situs (tracking-beacon.ts — client side, locale check)
   - 03 Admin /api/v1/events (admin.sariglassbangunan.com — SSR-side)
   - 04 CAPI gateway (capi.beriklan.co.id/healthz — server fetch 6s timeout)
   - 05 GTM (GTM-WQ2BFWVL — server fetch verify Pixel+GA4 ID grep)
   - 06 Dashboard ini (sgb.beriklan.co.id/tracking — always ok)
5. **Panel "Tes sendiri"** — 3 langkah bernomor + tombol "Buka /produk di tab baru" + "Beranda toko". Bahasa: "Buktikan tracking hidup dalam 10 detik. Hemat waktu klien baru dari 60 menit explain menjadi 30 detik demo."
6. **`/iklan` streamline** — kartu "🛰️ Status Tracking" 4-row checklist diganti 1 baris link ke /tracking (tidak duplikat).
7. **Sidebar** — grup "Iklan" += link "Tracking" (icon shield). Tampil di sidebar desktop + mobile drawer.

**Live verify (curl 23 Sep 07:10 WIB):**
```
API /api/tracking/log:
{
  "counters": { "totalAll": 2, "last24h": 0, "last7d": 2, "dedupePct": 100, "lastTs": "2026-09-21T18:50:07" },
  "events": [
    { id: 2, type: "wa_click", source: "go-live", pageUrl: "https://sariglassbangunan.com/", status: "deal", eventId: "sgp-golive-1790016606" },
    { id: 1, type: "wa_click", source: "gateway-test", pageUrl: ".../produk/tes-gateway", status: "batal", eventId: "sgp-test-1790015787" }
  ]
}
```

**File disentuh:** `src/{pages/tracking.astro, pages/api/tracking/log.ts, components/TrackingFlow.astro, components/Sidebar.astro}`, `src/pages/iklan.astro` (streamline).

**DoD achieved:**
- ✅ /tracking HTTP 200, 52KB, 6-hop rendered.
- ✅ API JSON valid, dedupe 100%, real data 2 event dari go-live/gateway-test.
- ✅ Sidebar link Tracking muncul 3× (desktop + mobile + banner /iklan).
- ✅ 0 emoji UI (lolos S2).
- ✅ `pnpm check` 0 error.
- ✅ `pnpm build` 7.42s OK.
- ✅ Screenshot `/tmp/opencode/sgb-s5/` (4 PNG: desktop viewport+full, /iklan banner, mobile tracking).

**Estimasi actual:** 1 sesi.

---

### S6 — AI/LLM Transparency 🟡

**Goal:** jawab jujur + visual "apakah AI tahu bisnis kita?" — user bisa cek sendiri kapan pun, tanpa mitos.

**Fakta teknis yang jadi dasar copy (JUJUR):**
- ChatGPT/Perplexity/Claude **tidak punya API submit** seperti Google Indexing API. Tidak ada yang bisa "kirim situs tiap hari ke semua AI" — siapa pun yang mengklaim itu, bohong.
- 3 jalur AI belajar tentang kita: **(1)** crawler mereka datang sendiri (GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, PerplexityBot + 8 UA lain — semua di-allow robots.txt ✅), **(2)** Bing index → ChatGPT Search membaca dari Bing → kita push IndexNow tiap 2 jam ✅, **(3)** `llms.txt` — ringkasan mesin-terbaca 25KB berisi 83 artikel ✅.
- Cron `llm-search-ping` (tiap 12 jam) memverifikasi ketiganya + sitemap. Yang bisa DIUKUR: AI referrals (traffic chatgpt.com dkk) + sitasi (disebut atau tidak saat orang tanya AI "toko bangunan majenang").

**Task:**
1. **Kartu edukasi "Cara AI belajar tentang kita"** — diagram SVG 3 jalur di atas + copy jujur. Pengganti kebingungan "kenapa AI tidak langsung tahu kita".
2. **Riwayat verify live:** tampilkan hasil `llm-search-ping` terakhir per item (robots 13 UA ✅ / llms.txt size+fresh ✅ / IndexNow key valid / sitemap terkirim) — data SUDAH disimpan di `cron_runs.summary` admin → parse via `fetchAdminCrons()` (helper S4) di endpoint audit yang sudah dipakai /health.
3. **Timeline freshness llms.txt:** kapan regenerate terakhir, berapa artikel tercakup, riwayat 30 hari (dari cron summary history) — sparkline kecil.
4. **AI referrals producer (metric `ai/referrals_7d` sekarang kosong):** beacon store SUDAH kirim `traffic_source` (chatgpt/perplexity/gemini terdeteksi dari referrer di `tracking-beacon.ts`) → admin agregasi harian dari tabel events → push metric via ingest (tambah di `push-metrics.ts`). **Opsi A ini dipilih** (data sudah ada, 0 akses baru). Opsi B (GA4 Data API) dibatalkan — butuh scope analytics tambahan di service account.
5. **Cek sitasi semi-otomatis:** UI checklist di /ai — 5 query × 3 engine (grid 15 sel), Bos/agent buka Perplexity/ChatGPT/Gemini manual → klik "Disebut ✓ / Tidak ✗" per sel → POST admin `ai-citations` (endpoint SUDAH ada) → ingest → dashboard. Tambah "cek terakhir: tanggal". Automation penuh via API berbayar (Perplexity Sonar / OpenAI) = keputusan Bos terpisah, JANGAN assume.
6. **Kartu konteks "Nilai AI search":** "1 dari 5 pencarian produk mulai lewat AI. Saat ChatGPT menyebut Sari Glass untuk 'toko bangunan Majenang', itu rekomendasi gratis yang bekerja selamanya."

**File:** `src/pages/ai.astro` (rewrite sebagian), `src/components/CitationChecklist.svelte` (baru), admin repo `src/pages/api/cron/push-metrics.ts` (metric ai/referrals_7d dari events), `src/lib/admin-crons.ts` (reuse S4).
**DoD:**
- /ai tidak ada lagi kata "menunggu" tanpa tanggal/aksi.
- Metric referrals terisi setelah 1× cron 05:00 (verifikasi via ingest → daily_metrics).
- Checklist sitasi bisa langsung dipakai Bos (tes 1 sel tersimpan + tampil).

**Estimasi:** 1–2 sesi.

---

### S7 — Promo & Iklan Integration 🟡

**Goal:** landing promo toko = senjata iklan terukur, bukan kartu misterius yang dikira "promo landing di dashboard".

**Task:**
1. **Relabel kartu /iklan:** "🏷️ Promo aktif" → **"Landing siap diiklankan"** + subjudul "Halaman tujuan iklan — dibuat di admin toko, tinggal dipasang di campaign Meta/Google. Dashboard ini tidak punya landing sendiri." Tiap promo tambah:
   - status chip: `belum diiklankan` / `ada lead masuk` (cek `lead_events.pageUrl` mengandung slug promo)
   - jumlah lead + estValue per promo
   - tombol **"Salin link UTM"** — generator client-side 5 preset (Meta feed / Meta story / Google search / TikTok / WA broadcast): `{storeUrl}/promo/{slug}?utm_source=…&utm_medium=…&utm_campaign=promo-{slug}&utm_content={preset}` → copy clipboard + toast + tercatat sebagai `utm_link_copy` (untuk tahu promo mana yang niat diiklankan).
2. **Wire tombol PAUSE rekomendasi kreatif (D4.4):** kartu rekomendasi dapat tombol "Jeda iklan ini" → modal konfirmasi (nama adset + spend 7h + konsekuensi) → GET `?dry=1` preview → POST `/api/iklan/action` (endpoint SUDAH ada; butuh `META_TOKEN` env di VPS — CEK dulu; jika belum ada: tombol jadi "Kirim permintaan ke agency" → email). Setiap eksekusi → tulis `audit_log`. ⛔ Eksekusi pause NYATA pertama kali = konfirmasi Bos di chat dulu.
3. **`/leads` filter promo** (melunasi D6.5 bagian yang belum): chip filter "Dari promo: semua / besi-8 / kia-kloset / keramik-40" — match `pageUrl ~ /promo/{slug}`.
4. **Google Ads placeholder konsisten:** semua varian "belum jalan (P9)" (5 lokasi: index/leads/roi/iklan×2) → SATU copy: "Siap aktif — campaign pertama menunggu perintah Bos."

**File:** `src/pages/iklan.astro`, `leads.astro`, `index.astro`, `roi.astro` (copy), `src/pages/api/iklan/action.ts` (+audit_log), `src/components/UtmCopy.svelte` (baru), `src/components/PauseAdModal.svelte` (baru).
**DoD:**
- Salin UTM tes paste → URL valid + tracking.json promo match.
- Filter promo /leads jalan (tes dengan 2 lead beacon promo yang ada).
- Pause dry-run jalan; eksekusi hanya dengan META_TOKEN + persetujuan Bos.
- Screenshot kartu "Landing siap diiklankan" versi baru.

**Estimasi:** 1–2 sesi.

---

### S8 — Engagement & Trust (bikin user balik tiap hari) 🟢

**Task:**
1. **Bell fungsional:** dropdown 5 alert terbaru — sumber: rule-engine copilot yang SUDAH ada (lead > 12h belum dibalas · cron error 24h · artikel terbit hari ini · keyword masuk TOP3 · deal baru). Extend `/api/copilot` dengan field `alerts[]` (severity + link). Badge merah = count severity tinggi. Klik alert → deep-link.
2. **Role beneran (spec C10):**
   - `viewer` = read-only murni: server menolak semua POST (403), UI sembunyikan form/tombol tulis.
   - `client_admin` = boleh tulis status lead + buat share link; TIDAK boleh /hq /health /radar /pause-ads /keywords-bulk.
   - Helper `can(user, action)` di `src/lib/auth/session.ts` — guard di SETIAP endpoint POST (bukan cuma hide UI).
   - Tes dengan login client `sariglassbangunan749@gmail.com`.
3. **`audit_log` diwire** (tabel ada, unused): helper `logAudit(tenantId, actor, action, target)` dipanggil di SEMUA POST (pipeline/update · notes · radar/watch · share · iklan/action · keywords/bulk). `/health` += tabel "20 aktivitas terakhir" (superadmin only).
4. **Nama produk final:** ganti semua "SGB Dashboard" → **"Beriklan Dashboard"** (cek title, sidebar footer, email subject lead-reminder, README).
5. **Ingest key beda per tenant** (learning rev-13): `scripts/rotate-key.ts` — generate key baru tenant `agency`, update `ingest_key_hash`, key baru dicatat di `secrets/VPS-CREDENTIALS.md` (JANGAN commit).
6. **`/api/pipeline/stale` scoping ringan:** tambah `?tenant=` wajib bila nanti multi-tenant (sekarang single-client low-risk — cukup komentar + TODO bernama, bukan kerja besar).

**File:** `src/layouts/Base.astro` (bell dropdown), `src/lib/auth/session.ts` (`can()`), `src/lib/audit.ts` (baru), semua `src/pages/api/**` POST, `src/pages/health.astro`, `scripts/rotate-key.ts` (baru), `README.md`.
**DoD:**
- Login client → semua POST ditolak 403 (tes curl dengan cookie client) + UI tanpa tombol tulis (screenshot).
- Bell tampil alert nyata (minimal 1 dari data sekarang: stale lead / cron).
- `SELECT COUNT(*) FROM audit_log` > 0 setelah tes aksi.

**Estimasi:** 2 sesi.

---

### S9 — QA Final + Dokumentasi 🟢

**Task:**
1. **pw-vision full sweep:** 16 halaman (14 lama + /sistem + /tracking) × mobile 390×844 + desktop 1440×900 → 0 overflow, 0 console error, 0 HTTP ≥ 400, small targets < 24px hanya elemen non-aksi.
2. **Perf budget:** /keywords < 100KB HTML (dari 636KB); halaman lain < 80KB; LayerChart hydrate < 1s; /sistem + /tracking animasi tidak bikin INP > 200ms.
3. **E2E manual script (didokumentasikan, dijalankan sekali):** login → / pagi → /sistem ikuti 1 artikel → /tracking tes sendiri (klik WA di toko → event muncul) → /keywords sort peluang + bulk action → /leads tandai deal → /roi revenue terisi → /health audit_log ada → bell alert.
4. **Dokumentasi:**
   - `README.md` sgb-dashboard: daftar halaman baru + alur data.
   - `docs/WORK-PHASES.md` (repo sariglassbangunan — single source of truth): section "SGB S1–S9" + rev entry per phase.
   - File ini (`sgnadmin.md`): update status ✅ per phase + tanggal + commit hash.
   - Cross-ref dari `documentation-admin.md` §dashboard.
5. **Deploy check:** setiap push → Coolify auto-deploy → smoke test `/api/health` + 3 halaman (/, /sistem, /tracking) sebelum lanjut phase berikutnya.

**Estimasi:** 1 sesi.

---

## 3. LIBS & REFERENSI (hasil riset — hemat bundle, DNA konsisten)

| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Chart | `layerchart@2.5` (SUDAH ada) | Svelte 5 native; ECharts sudah dibuang (commit a82451a) — jangan tambah lagi |
| Flow animation /sistem | **CSS-native dulu** (`@keyframes` + `offset-path` + SVG stroke-dashoffset) | 0 dep baru; `motion@13` mini animate (2.3kb) hanya jika CSS kurang — DNA store: motion-first tapi dashboard harus ringan |
| Icon | `Icon.astro` inline SVG monoline (extract dari Sidebar) | @lucide/svelte opsional; pola inline sudah ada — konsisten, 0 dep |
| List reorder /tracking log | `@formkit/auto-animate` (3kb) | highlight event baru mulus (DNA store juga pakai) |
| Toast | `svelte-sonner` (SUDAH ada) | copy UTM, deal saved, bulk action |
| Tabel keyword | server-side pagination + CSS (BUKAN lib grid/virtual-scroll) | 50 baris/halaman tidak butuh virtualisasi |
| Diagram tracking | SVG custom + pulse-dot (class sudah ada di global.css) | konsisten DNA |

**Referensi pola sukses:** `adminwork.md` P1–P8 (sariglass-admin — MediaUpload, PromoLandingForm per-section), `docs/IMPROVEMENT.md` D1–D6, AGENTS.md store §13 (DNA motion/CSS art), spec SGB-DASHBOARD §7 (security requirements yang belum diimplement).

## 4. ATURAN KERAS (tidak berubah)

1. ⛔ **TIDAK create campaign Meta/Google tanpa perintah eksplisit Bos** (P9 tetap terkunci). Pause ads S7 = wire UI + dry-run; eksekusi nyata pertama = konfirmasi chat.
2. **Tidak ada klaim palsu** — setiap angka ada label sumbernya (S1). Insight tidak boleh memuji kalau data kosong.
3. **Secrets tidak pernah masuk commit** — ingest key rotate via `secrets/VPS-CREDENTIALS.md` (gitignored).
4. **Deploy = git push ke Coolify**; JANGAN sentuh resource/project lain di VPS.
5. `<script>` .astro = JS murni (house rule); Svelte 5 runes only; tidak ada `export let`.
6. Tiap phase: `pnpm check` 0 error + `pnpm build` sukses + screenshot bukti + commit granular + WORK-PHASES update.
7. Reduced-motion gate untuk SEMUA animasi baru (S4/S5).
8. Single source of truth phase tracker: `sariglassbangunan.com/docs/WORK-PHASES.md`.

## 5. ESTIMASI TOTAL

| Phase | Isi | Estimasi | Prioritas |
|---|---|---|---|
| S1 | Bug integritas data (trust) | 1 sesi | 🔴 |
| S2 | UX/copy 14 halaman + emoji→SVG + mobile audit | 1–2 sesi | 🔴 |
| S4 | ⭐ /sistem — pipeline mesin live | 2 sesi | 🟢 killer |
| S5 | ⭐ /tracking — visualisasi + tes sendiri | 1–2 sesi | 🟢 killer |
| S3 | Keyword intelligence | 2 sesi | 🟡 |
| S6 | AI/LLM transparency + referrals producer | 1–2 sesi | 🟡 |
| S7 | Promo/iklan integration + UTM + pause | 1–2 sesi | 🟡 |
| S8 | Bell + role + audit_log + key rotate | 2 sesi | 🟢 |
| S9 | QA full sweep + dokumentasi | 1 sesi | 🟢 |
| **Total** | | **±12–16 sesi** | |

---

*Dibuat 23 Sep 2026 dari audit live (login superadmin, 14 halaman, curl + code review repo sgb-dashboard 36 commit terakhir `cc9b12f`).*
