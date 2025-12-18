"use client";

import { Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Chart } from "@/lib/types";

interface PieChartItemProps {
  chart: Chart;
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function PieChartItem({ chart }: PieChartItemProps) {
  const chartData = chart.data.map((item) => ({
    ...item,
    fill: `var(--color-${item.label.toLowerCase().replace(/\s+/g, "-")})`,
  }));

  const chartConfig = chart.data.reduce(
    (acc, item, index) => {
      const key = item.label.toLowerCase().replace(/\s+/g, "-");
      acc[key] = {
        label: item.label,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
      return acc;
    },
    {
      value: { label: "Value" },
    } as ChartConfig,
  );

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-lg">{chart.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <ChartContainer
          config={chartConfig}
          className="[&_.recharts-pie-label-text]:fill-foreground mx-auto aspect-square max-h-[250px] pb-0"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            <Pie data={chartData} dataKey="value" label nameKey="label" />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-center text-sm">
          {chart.description}
        </p>
      </CardFooter>
    </Card>
  );
}
