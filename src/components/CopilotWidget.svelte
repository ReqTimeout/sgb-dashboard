<script lang="ts">
  import { onMount } from "svelte";

  interface Action {
    id: string;
    category: string;
    title: string;
    detail: string;
    impact: string;
    cta?: { label: string; href: string };
    severity: "info" | "warn" | "good";
  }

  let actions: Action[] = $state([]);
  let loading = $state(true);
  let model = $state("");

  onMount(async () => {
    try {
      const r = await fetch("/api/copilot");
      if (r.ok) {
        const j = await r.json();
        actions = j.actions ?? [];
        model = j.model ?? "";
      }
    } catch { /* ignore */ }
    loading = false;
  });

  const severityIcon: Record<string, string> = {
    warn: "⚠️",
    info: "💡",
    good: "✅",
  };
  const severityBorder: Record<string, string> = {
    warn: "border-[color:var(--danger)]/30 bg-[color:var(--danger-soft)]",
    info: "border-[color:var(--info)]/30 bg-[color:var(--info-soft)]",
    good: "border-[color:var(--success)]/30 bg-[color:var(--success-soft)]",
  };
  const categoryLabel: Record<string, string> = {
    seo: "SEO",
    ads: "Iklan",
    lead: "Lead",
    system: "Sistem",
    content: "Konten",
  };
</script>

<div class="copilot">
  <div class="flex items-center gap-2">
    <div class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#DC2626] to-[#FACC15] text-white shadow-md">
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9.5 2 11 5.5 14.5 6.5 11.5 9 12 13 9.5 10.5 6 11.5 7 7.5 5 5zM18 14l1.5 3 3 1-3 1-1.5 3-1.5-3-3-1 3-1z"/></svg>
    </div>
    <div class="flex-1">
      <div class="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-faint)]">AI Copilot — Pak Bos</div>
      <div class="text-[11px] text-[color:var(--text-faint)]">Aksi spesifik dari data hari ini · {model || "loading"}</div>
    </div>
    {#if loading}
      <span class="chip text-[10px]">Memuat…</span>
    {/if}
  </div>

  {#if !loading && actions.length === 0}
    <div class="mt-3 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-2)]/60 p-4 text-sm text-[color:var(--text-muted)]">
      Sampeyan, semua mesin jalan normal. Tidak ada aksi urgent hari ini.
    </div>
  {/if}

  <ul class="mt-3 space-y-2.5">
    {#each actions as a (a.id)}
      <li class="rounded-lg border p-3 {severityBorder[a.severity] ?? ''}">
        <div class="flex items-start gap-3">
          <span class="text-base leading-none">{severityIcon[a.severity] ?? "•"}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="chip text-[10px]">{categoryLabel[a.category] ?? a.category}</span>
              <h4 class="font-[family-name:var(--font-heading)] text-sm font-bold leading-snug">{a.title}</h4>
            </div>
            <p class="mt-1 text-xs leading-relaxed text-[color:var(--text-secondary)]">{a.detail}</p>
            <div class="mt-1.5 flex items-center gap-2">
              <span class="text-[10px] font-semibold text-[color:var(--brand)]">Dampak: {a.impact}</span>
              {#if a.cta}
                <a href={a.cta.href} class="btn btn-ghost !py-0.5 !px-2 text-[11px] font-semibold">{a.cta.label} →</a>
              {/if}
            </div>
          </div>
        </div>
      </li>
    {/each}
  </ul>
</div>
