'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export type ChartPoint = { bucket: string } & Record<string, number | string>;

export function UsageChart({
  points,
  config,
  formatBucket,
}: {
  points: readonly ChartPoint[];
  config: ChartConfig;
  formatBucket: (bucket: string) => string;
}) {
  const keys = Object.keys(config);
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <AreaChart
        accessibilityLayer
        data={[...points]}
        margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey="bucket" hide />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(bucket) => formatBucket(String(bucket))}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((key) => (
          <Area
            key={key}
            dataKey={key}
            type="linear"
            stackId="stack"
            stroke={`var(--color-${key})`}
            fill={`var(--color-${key})`}
            fillOpacity={0.3}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
