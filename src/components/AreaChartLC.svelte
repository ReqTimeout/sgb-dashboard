<script lang="ts">
  import { Area, Axis, Chart, Highlight, Svg, Tooltip } from "layerchart";
  import type { Point } from "../lib/data";

  interface Props {
    data: Point[];
    height?: number;
  }
  const { data, height = 220 }: Props = $props();

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
      <Axis placement="bottom" rule class="text-[10px] fill-[color:var(--text-faint)] stroke-[color:var(--border-default)]" />
      <Area
        line={{ class: "stroke-[color:var(--brand)] stroke-2" }}
        class="fill-[color:var(--brand)] fill-opacity-10"
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
