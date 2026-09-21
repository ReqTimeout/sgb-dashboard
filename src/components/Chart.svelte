<!-- Wrapper ECharts untuk Svelte 5 — chart di-render client-side saja (SSR-safe).
  Props: option (objek ECharts), height (px). Auto-resize mengikuti container. -->
<script lang="ts">
  import { onDestroy } from "svelte";
  import * as echarts from "echarts";

  let { option, height = 280 }: { option: Record<string, unknown>; height?: number } = $props();
  let el: HTMLDivElement | undefined = $state(undefined);
  let chart: echarts.ECharts | null = null;

  $effect(() => {
    if (!el) return;
    if (!chart) chart = echarts.init(el);
    chart.setOption(option, true);
    const ro = new ResizeObserver(() => chart?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  });

  onDestroy(() => {
    chart?.dispose();
    chart = null;
  });
</script>

<div bind:this={el} style={`height:${height}px;min-width:0`}></div>
