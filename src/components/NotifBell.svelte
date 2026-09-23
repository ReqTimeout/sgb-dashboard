<script lang="ts">
  import { onMount } from "svelte";

  interface Alert {
    id: string;
    title: string;
    href: string;
    severity: "warn" | "info" | "good";
  }

  let alerts: Alert[] = $state([]);
  let open = $state(false);
  let loaded = $state(false);

  const warnCount = $derived(alerts.filter((a) => a.severity === "warn").length);

  onMount(async () => {
    try {
      const r = await fetch("/api/copilot");
      if (r.ok) {
        const j = await r.json();
        alerts = Array.isArray(j.alerts) ? j.alerts.slice(0, 5) : [];
      }
    } catch { /* bell tetap tampil, tanpa badge */ }
    loaded = true;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") open = false; };
    const onClick = (e: MouseEvent) => {
      const el = document.getElementById("notif-bell-wrap");
      if (open && el && !el.contains(e.target as Node)) open = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  });

  const dot: Record<string, string> = {
    warn: "var(--c-bad)",
    info: "var(--c-info)",
    good: "var(--c-good)",
  };
</script>

<div id="notif-bell-wrap" class="relative">
  <button
    type="button"
    class="btn btn-ghost relative h-9 w-9 justify-center px-0"
    aria-label="Notifikasi"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9m5 13a2 2 0 0 0 4 0"/></svg>
    {#if loaded && warnCount > 0}
      <span class="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-[color:var(--danger)] px-1 text-[9px] font-bold text-white">{warnCount}</span>
    {/if}
  </button>

  {#if open}
    <div class="absolute right-0 z-50 mt-2 w-[min(88vw,320px)] overflow-hidden rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] shadow-lg" role="menu">
      <div class="border-b border-[color:var(--border-subtle)] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-faint)]">
        Notifikasi · otomatis
      </div>
      {#if !loaded}
        <p class="px-3 py-4 text-xs text-[color:var(--text-faint)]">Memuat…</p>
      {:else if alerts.length === 0}
        <p class="px-3 py-4 text-xs text-[color:var(--text-faint)]">Tidak ada alert. Semua sistem normal.</p>
      {:else}
        <ul class="max-h-[50vh] overflow-y-auto p-1.5">
          {#each alerts as a (a.id)}
            <li>
              <a
                href={a.href}
                class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-[color:var(--bg-surface-2)]"
                onclick={() => (open = false)}
              >
                <span class="h-2 w-2 shrink-0 rounded-full" style={`background:${dot[a.severity] ?? "var(--text-faint)"}`}></span>
                <span class="min-w-0 flex-1 truncate">{a.title}</span>
                <svg class="h-3.5 w-3.5 shrink-0 text-[color:var(--text-faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>
