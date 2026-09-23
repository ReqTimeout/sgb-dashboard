<script lang="ts">
  import { toast } from "svelte-sonner";

  interface Props {
    slug: string;
    storeUrl?: string;
  }
  let { slug, storeUrl = "https://sariglassbangunan.com" }: Props = $props();

  interface Preset { id: string; label: string; source: string; medium: string; content: string }
  const PRESETS: Preset[] = [
    { id: "meta-feed",   label: "Meta feed",    source: "meta",     medium: "paid_social", content: "feed" },
    { id: "meta-story",  label: "Meta story",   source: "meta",     medium: "paid_social", content: "story" },
    { id: "google",      label: "Google search", source: "google",  medium: "cpc",          content: "search" },
    { id: "tiktok",      label: "TikTok",       source: "tiktok",   medium: "paid_social", content: "infeed" },
    { id: "wa",          label: "WA broadcast", source: "whatsapp", medium: "broadcast",    content: "blast" },
  ];

  let presetId: string = $state(PRESETS[0].id);
  let copied = $state(false);
  let logging = $state(false);

  const preset = $derived(PRESETS.find((p) => p.id === presetId) ?? PRESETS[0]);
  const url = $derived(
    `${storeUrl.replace(/\/$/, "")}/promo/${slug}` +
    `?utm_source=${preset.source}&utm_medium=${preset.medium}` +
    `&utm_campaign=promo-${slug}&utm_content=${preset.content}`
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback browser lama: textarea + execCommand
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* abaikan */ }
      ta.remove();
    }
    copied = true;
    toast.success("Link UTM tersalin — tempel di Ad Manager / sheet.");
    setTimeout(() => { copied = false; }, 2500);
    // Catat ke audit_log (fire-and-forget — jangan blokir UX).
    if (!logging) {
      logging = true;
      const fd = new FormData();
      fd.set("action", "utm_copy");
      fd.set("slug", slug);
      fd.set("preset", presetId);
      fetch("/api/iklan/action", { method: "POST", body: fd }).catch(() => {}).finally(() => { logging = false; });
    }
  }
</script>

<div class="flex items-center gap-1.5">
  <select
    bind:value={presetId}
    aria-label="Preset UTM"
    title="Pilih preset channel iklan"
    class="max-w-[128px] truncate rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-2 py-1 text-[11px]"
  >
    {#each PRESETS as p}
      <option value={p.id}>{p.label}</option>
    {/each}
  </select>
  <button
    type="button"
    onclick={copy}
    title={url}
    class="btn shrink-0 !py-1 text-xs"
  >
    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9h12v12H9zM5 5h12v3M5 5H3v14h12" /></svg>
    {copied ? "Tersalin!" : "Salin link UTM"}
  </button>
</div>
