// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";

// SGB Dashboard — SSR (butuh server Node): session auth multi-tenant + ingest API.
// Deploy: Coolify VPS, project agency-beriklan (lihat WORK-PHASES.md repo sariglassbangunan).
export default defineConfig({
  output: "server",
  // checkOrigin bawaan DIMATIKAN: di balik reverse-proxy (Traefik Coolify),
  // Host yang dilihat aplikasi bisa beda dengan domain publik → POST dianggap
  // cross-site (403). Diganti validasi CSRF sendiri berbasis APP_URL (src/middleware.ts).
  security: { checkOrigin: false },
  adapter: node({ mode: "standalone" }),
  integrations: [svelte()],
  vite: {
    plugins: [tailwindcss()],
  },
});
