<script lang="ts">
  import { Axis, Bars, Chart, Highlight, Svg, Tooltip } from "layerchart";

  interface BarItem {
    label: string;
    value: number;
  }
  interface Props {
    data: BarItem[];
    height?: number;
    barClass?: string;
  }
  const { data, height = 220, barClass = "fill-[#cbd5e1] dark:fill-[#3a4868]" }: Props = $props();
</script>

<div style="height: {height}px;">
  <Chart
    {data}
    x="label"
    y="value"
    yDomain={[0, null]}
    yNice
    cPadding={{ left: 4, right: 4 }}
    padding={{ left: 44, right: 16, top: 12, bottom: 32 }}
    tooltip={{ mode: "band" }}
  >
    <Svg>
      <Axis placement="left" grid rule class="text-[10px] fill-[color:var(--text-faint)] stroke-[color:var(--border-subtle)]" />
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
      <Bars radius={3} class={barClass} inset={2} />
      <Highlight area />
    </Svg>
    <Tooltip.Root>
      {#snippet children({ data }: { data: BarItem })}
        <Tooltip.Header>{data.label}</Tooltip.Header>
        <Tooltip.List>
          <Tooltip.Item label="Nilai" value={data.value} />
        </Tooltip.List>
      {/snippet}
    </Tooltip.Root>
  </Chart>
</div>
