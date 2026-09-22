<script lang="ts">
  import { Axis, Chart, Highlight, Spline, Svg, Tooltip } from "layerchart";
  import type { Point } from "../lib/data";

  interface Props {
    data: Point[];
    height?: number;
    color?: string;
  }
  const { data, height = 200, color = "var(--c-neutral)" }: Props = $props();

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
    padding={{ left: 44, right: 16, top: 14, bottom: 28 }}
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
      <Spline data={rows} x="label" y="value" stroke={color} class="stroke-2" />
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
