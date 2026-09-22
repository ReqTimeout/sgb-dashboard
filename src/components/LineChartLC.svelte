<script lang="ts">
  import { LineChart, Chart, Svg, Axis, Grid } from "layerchart";
  import type { Point } from "../lib/data";

  interface Props {
    data: Point[];
    height?: number;
    color?: string;
    fill?: boolean;
  }
  const { data, height = 200, color = "var(--brand)", fill = true }: Props = $props();

  const formatted = $derived(
    data.map((p) => ({ label: p.date.slice(5), fullDate: p.date, value: p.value })),
  );
</script>

<div style="height: {height}px;">
  <LineChart
    data={formatted}
    x="label"
    y="value"
    axis="x"
    padding={{ left: 8, right: 8, top: 12, bottom: 24 }}
    line={{ class: "stroke-2", style: `stroke: ${color}`, curve: "monotoneX" }}
    area={fill ? { style: `fill: ${color}; fill-opacity: 0.10`, curve: "monotoneX" } : undefined}
    points={{ class: "fill-[color:var(--bg-surface)]", style: `stroke: ${color}; stroke-width: 2`, r: 2.5 }}
    props={{
      xAxis: { tickLength: 0, class: "text-[10px] fill-[color:var(--text-faint)]" },
      yAxis: { tickLength: 0, class: "text-[10px] fill-[color:var(--text-faint)]" },
    }}
  >
    {#snippet belowMarks()}
      <Svg class="overflow-visible">
        <Axis placement="bottom" class="stroke-[color:var(--border-default)]" />
        <Grid class="stroke-[color:var(--border-subtle)] stroke-1" horizontal={false} />
      </Svg>
    {/snippet}
    {#snippet tooltip()}
      <Chart.Tooltip let:data>
        <div class="rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] px-2.5 py-1.5 text-xs shadow-md">
          <div class="font-mono-num font-bold">{data.value}</div>
          <div class="text-[color:var(--text-faint)]">{data.fullDate}</div>
        </div>
      </Chart.Tooltip>
    {/snippet}
  </LineChart>
</div>
