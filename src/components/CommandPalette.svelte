<script lang="ts">
  import { onMount } from "svelte";

  interface Item { href: string; label: string; group: string; superadmin?: boolean; }
  interface Props { role?: string }
  let { role = "viewer" }: Props = $props();

  const items: Item[] = [
    { group: "Ringkasan", label: "Pagi ini", href: "/" },
    { group: "SEO", label: "Performa SEO", href: "/seo" },
    { group: "SEO", label: "Ranking", href: "/ranking" },
    { group: "SEO", label: "Konten", href: "/konten" },
    { group: "SEO", label: "Keyword", href: "/keywords" },
    { group: "Iklan", label: "Performa Iklan", href: "/iklan" },
    { group: "Iklan", label: "ROI", href: "/roi" },
    { group: "Iklan", label: "Radar Kompetitor", href: "/radar", superadmin: true },
    { group: "Lead", label: "Pipeline", href: "/leads" },
    { group: "Lead", label: "Laporan", href: "/laporan" },
    { group: "Sistem", label: "AI Search", href: "/ai" },
    { group: "Sistem", label: "HQ", href: "/hq", superadmin: true },
    { group: "Sistem", label: "Health", href: "/health", superadmin: true },
  ];
  // S8: sembunyikan halaman agency dari palette non-superadmin (server tetap guard).
  const visible = $derived(role === "superadmin" ? items : items.filter((it) => !it.superadmin));

  let open = $state(false);
  let q = $state("");
  let i = $state(0);
  let inputEl: HTMLInputElement | undefined;

  const filtered = $derived(
    q
      ? visible.filter((it) => (it.label + it.href).toLowerCase().includes(q.toLowerCase())).slice(0, 8)
      : visible.slice(0, 8),
  );

  function show() {
    open = true;
    q = "";
    i = 0;
    setTimeout(() => inputEl?.focus(), 20);
  }
  function hide() { open = false; }
  function go(href: string) { window.location.href = href; }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open ? hide() : show();
      return;
    }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); hide(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); i = Math.min(filtered.length - 1, i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); i = Math.max(0, i - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const it = filtered[i]; if (it) go(it.href); }
  }

  onMount(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<button
  type="button"
  class="hidden items-center gap-2 rounded-lg border border-[color:var(--border-default)] px-3 py-1.5 text-xs text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] md:flex"
  onclick={show}
  aria-label="Buka command palette"
>
  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
  Cari halaman
  <span class="kbd ml-2">⌘K</span>
</button>

{#if open}
  <div
    role="dialog"
    aria-modal="true"
    class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] backdrop-blur-sm"
    style="background: rgb(0 0 0 / 0.45)"
    onclick={(e) => { if (e.target === e.currentTarget) hide(); }}
  >
    <div
      class="w-[min(92vw,560px)] overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]"
      style="box-shadow: var(--shadow-elevated)"
    >
      <div class="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-4 py-3">
        <svg class="h-4 w-4 text-[color:var(--text-faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>
        <input
          bind:this={inputEl}
          bind:value={q}
          type="text"
          placeholder="Ketik halaman…"
          class="flex-1 border-0 bg-transparent p-0 text-sm focus:outline-none focus:ring-0"
        />
        <span class="kbd">esc</span>
      </div>
      <ul class="max-h-[60vh] overflow-y-auto p-1.5">
        {#each filtered as it, idx (it.href)}
          <li>
            <button
              type="button"
              class:list={[
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                idx === i ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]" : "hover:bg-[color:var(--bg-surface-2)]",
              ]}
              onmouseenter={() => (i = idx)}
              onclick={() => go(it.href)}
            >
              <span class="font-medium">{it.label}</span>
              <span class="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-faint)]">{it.group} · {it.href}</span>
            </button>
          </li>
        {:else}
          <li class="px-3 py-6 text-center text-xs text-[color:var(--text-faint)]">Tidak ada hasil.</li>
        {/each}
      </ul>
      <div class="border-t border-[color:var(--border-subtle)] px-4 py-2 text-[10px] text-[color:var(--text-faint)]">
        <span class="kbd">↑</span> <span class="kbd">↓</span> pilih ·
        <span class="kbd">↵</span> buka ·
        <span class="kbd">esc</span> tutup
      </div>
    </div>
  </div>
{/if}
