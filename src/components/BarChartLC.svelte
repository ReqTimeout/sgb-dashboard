<script lang="ts">
  import { BarChart, Chart, Svg, Axis, Grid } from "layerchart";

  interface BarItem {
    label: string;
    value: number;
    color?: string;
  }
  interface Props {
    data: BarItem[];
    height?: number;
    defaultColor?: string;
  }
  const { data, height = 220, defaultColor = "var(--brand)" }: Props = $props();
</script>

<div style="height: {height}px;">
  <BarChart
    data={data}
    x="label"
    y="value"
    axis="x"
    padding={{ left: 8, right: 8, top: 12, bottom: 28 }}
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
    {#snippet marks()}
      <Chart.Bar
        let:data
        fill={data.color ?? defaultColor}
        class="rx-1"
      />
    {/snippet}
    {#snippet tooltip()}
      <Chart.Tooltip let:data>
        <div class="rounded-md border border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] px-2.5 py-1.5 text-xs shadow-md">
          <div class="font-mono-num font-bold">{data.value}</div>
          <div class="text-[color:var(--text-faint)]">{data.label}</div>
        </div>
      </Chart.Tooltip>
    {/snippet}
  </BarChart>
</div>
