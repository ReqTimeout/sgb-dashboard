<script lang="ts">
  import { AreaChart, Chart, Svg, Axis, Grid } from "layerchart";
  import type { Point } from "../lib/data";

  interface Props {
    data: Point[];
    height?: number;
    color?: string;
  }
  const { data, height = 220, color = "var(--brand)" }: Props = $props();

  const formatted = $derived(
    data.map((p) => ({
      date: p.date.slice(5),
      fullDate: p.date,
      value: p.value,
    })),
  );
</script>

<div style="height: {height}px;">
  <AreaChart
    data={formatted}
    x="date"
    y="value"
    axis="x"
    padding={{ left: 8, right: 8, top: 12, bottom: 24 }}
    line={{ class: "stroke-[color:var(--brand)] stroke-2", curve: "monotoneX" }}
    area={{ class: "fill-[color:var(--brand)] fill-opacity-12", curve: "monotoneX" }}
    props={{
      xAxis: {
        format: (v: string) => v,
        tickLength: 0,
        class: "text-[10px] fill-[color:var(--text-faint)]",
      },
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
  </AreaChart>
</div>
