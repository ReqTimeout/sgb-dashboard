<script lang="ts">
  import { toast } from "svelte-sonner";

  interface Ad {
    id: string;
    name: string;
    reason: string;
    spend: number;
    freq: number;
  }
  interface Props {
    ad: Ad;
    hasToken: boolean;
    agencyEmail?: string;
  }
  let { ad, hasToken, agencyEmail = "beriklan.agency@gmail.com" }: Props = $props();

  let open = $state(false);
  let phase: "confirm" | "dry" | "done" = $state("confirm");
  let busy = $state(false);
  let dryInfo: string = $state("");
  let result: { ok: boolean; msg: string } | null = $state(null);

  function fmtRp(n: number): string {
    return "Rp" + Math.round(n).toLocaleString("id-ID");
  }

  function mailto(): string {
    const subject = encodeURIComponent(`[SGB] Minta jeda adset: ${ad.name}`);
    const body = encodeURIComponent(
      `Halo agency,\n\nMinta tolong jeda adset ini di Meta Ads Manager:\n\n- Nama: ${ad.name}\n- Adset ID: ${ad.id}\n- Alasan: ${ad.reason}\n- Spend: ${fmtRp(ad.spend)} · freq ${ad.freq.toFixed(1)}\n\nTerima kasih.`
    );
    return `mailto:${agencyEmail}?subject=${subject}&body=${body}`;
  }

  function show() {
    phase = "confirm";
    result = null;
    dryInfo = "";
    open = true;
  }
  function hide() {
    if (!busy) open = false;
  }

  async function postDry(dry: boolean): Promise<Response> {
    const fd = new FormData();
    fd.set("action", "pause");
    fd.set("id", ad.id);
    return fetch(`/api/iklan/action${dry ? "?dry=1" : ""}`, { method: "POST", body: fd });
  }

  async function runDry() {
    busy = true;
    try {
      const r = await postDry(true);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        result = { ok: false, msg: j.error ?? `Server ${r.status}` };
        phase = "done";
        return;
      }
      dryInfo = j.will_call ?? `POST /${ad.id}/pause`;
      phase = "dry";
    } catch (e) {
      result = { ok: false, msg: e instanceof Error ? e.message : String(e) };
      phase = "done";
    } finally {
      busy = false;
    }
  }

  async function runReal() {
    busy = true;
    try {
      const r = await postDry(false);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        result = { ok: true, msg: `Adset ${ad.name} dijeda di Meta. Tercatat di audit_log.` };
        toast.success("Adset dijeda.");
      } else {
        result = { ok: false, msg: j.error ?? JSON.stringify(j.fb ?? j).slice(0, 200) };
        toast.error("Gagal menjeda — lihat detail.");
      }
      phase = "done";
    } catch (e) {
      result = { ok: false, msg: e instanceof Error ? e.message : String(e) };
      phase = "done";
    } finally {
      busy = false;
    }
  }
</script>

{#if !hasToken}
  <a
    href={mailto()}
    title="META_TOKEN belum diset di server — kirim permintaan jeda ke agency via email"
    class="btn shrink-0 !py-1 text-xs"
  >
    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
    Kirim permintaan ke agency
  </a>
{:else}
  <button type="button" onclick={show} title="Jeda adset ini di Meta (dry-run dulu, konfirmasi 2 langkah)" class="btn shrink-0 !py-1 text-xs">
    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
    Jeda iklan ini
  </button>
{/if}

{#if open && hasToken}
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Konfirmasi jeda iklan"
    class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto pt-[10vh] backdrop-blur-sm"
    style="background: rgb(0 0 0 / 0.45)"
    onclick={(e) => { if (e.target === e.currentTarget) hide(); }}
  >
    <div
      class="w-[min(92vw,520px)] overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]"
      style="box-shadow: var(--shadow-elevated)"
    >
      <div class="flex items-center justify-between border-b border-[color:var(--border-subtle)] px-4 py-3">
        <div class="font-[family-name:var(--font-heading)] text-sm font-bold">Jeda iklan ini?</div>
        <button type="button" onclick={hide} aria-label="Tutup" class="rounded p-1 text-[color:var(--text-faint)] hover:text-[color:var(--text-primary)]">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div class="space-y-3 px-4 py-4 text-sm">
        <div class="rounded-lg bg-[color:var(--bg-surface-2)]/60 p-3">
          <div class="truncate font-semibold">{ad.name}</div>
          <div class="mt-0.5 text-[11px] text-[color:var(--text-muted)]">{ad.reason}</div>
          <div class="mt-0.5 text-[11px] text-[color:var(--text-faint)]">spend {fmtRp(ad.spend)} · freq {ad.freq.toFixed(1)} · ID {ad.id}</div>
        </div>

        <div class="rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning-soft)] p-3 text-xs leading-relaxed">
          <strong>Konsekuensi:</strong> adset berhenti belanja <em>sekarang juga</em> di Meta.
          Chat WA dari adset ini ikut berhenti. Bisa dinyalakan lagi manual di Ads Manager.
          Setiap klik tombol tercatat di audit_log.
        </div>

        {#if phase === "dry" && dryInfo}
          <div class="rounded-lg border border-[color:var(--info)]/40 bg-[color:var(--bg-surface-2)]/60 p-3 font-mono text-[11px]">
            <div class="font-semibold">Dry-run OK — rencana eksekusi:</div>
            <div class="mt-1 break-all">{dryInfo}</div>
          </div>
        {/if}

        {#if phase === "done" && result}
          <div
            class="rounded-lg border p-3 text-xs"
            class:list={[
              result.ok
                ? "border-[color:var(--success)]/40 bg-[color:var(--success-soft)]"
                : "border-[color:var(--danger)]/40 bg-[color:var(--danger-soft)]",
            ]}
          >
            <strong>{result.ok ? "Berhasil." : "Gagal."}</strong> {result.msg}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-[color:var(--border-subtle)] px-4 py-3">
        {#if phase === "confirm"}
          <button type="button" onclick={hide} disabled={busy} class="btn !py-1.5 text-xs">Batal</button>
          <button type="button" onclick={runDry} disabled={busy} class="btn btn-primary !py-1.5 text-xs">
            {busy ? "Mengecek…" : "Cek dulu (dry-run)"}
          </button>
        {:else if phase === "dry"}
          <button type="button" onclick={hide} disabled={busy} class="btn !py-1.5 text-xs">Batal</button>
          <button type="button" onclick={runReal} disabled={busy} class="btn !py-1.5 text-xs" style="background:var(--c-bad);border-color:var(--c-bad);color:#fff">
            {busy ? "Menjeda…" : "Jeda beneran"}
          </button>
        {:else}
          <button type="button" onclick={hide} class="btn btn-primary !py-1.5 text-xs">Tutup</button>
        {/if}
      </div>
    </div>
  </div>
{/if}
