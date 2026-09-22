<script lang="ts">
  import { Area, Axis, Chart, Highlight, Svg, Tooltip } from "layerchart";
  import type { Point } from "../lib/data";

  interface Props {
    data: Point[];
    height?: number;
    /** Warna garis. Default netral (slate). Hijau/merah HANYA untuk status baik/buruk. */
    color?: string;
  }
  const { data, height = 220, color = "var(--c-neutral)" }: Props = $props();

  type Row = { label: string; fullDate: string; value: number };
  const rows: Row[] = $derived(
    data.map((p) => ({ label: p.date.slice(5), fullDate: p.date, value: p.value })),
  );
</script>

<div style="height: {height}px;">
  <Chart
    data={rows}
    x="label"
    y="value"
    yDomain={[0, null]}
    yNice
    padding={{ left: 36, right: 8, top: 12, bottom: 24 }}
    tooltip={{ mode: "bisect-x" }}
  >
    <Svg>
      <Axis placement="left" grid rule class="text-[10px] fill-[color:var(--text-faint)] stroke-[color:var(--border-default)]" />
      <Axis
        placement="bottom"
        rule
        class="text-[10px] fill-[color:var(--text-faint)] stroke-[color:var(--border-default)]"
        ticks={(scale) => {
          const dom = scale.domain();
          const step = Math.max(1, Math.ceil(dom.length / 6));
          return dom.filter((_, i) => i % step === 0);
        }}
      />
      <Area
        line={{ style: `stroke: ${color}; stroke-width: 2` }}
        style={`fill: ${color}; fill-opacity: 0.08`}
      />
      <Highlight points lines />
    </Svg>
    <Tooltip.Root>
      {#snippet children({ data }: { data: Row })}
        <Tooltip.Header>{data.fullDate}</Tooltip.Header>
        <Tooltip.List>
          <Tooltip.Item label="Nilai" value={data.value} />
        </Tooltip.List>
      {/snippet}
    </Tooltip.Root>
  </Chart>
</div>
