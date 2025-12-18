"use client";

import { Chart } from "@/lib/types";

import { BarChartItem } from "./bar-chart";
import { LineChartItem } from "./line-chart";
import { PieChartItem } from "./pie-chart";

interface ReviewChartsProps {
  charts: Chart[];
}

export function ReviewCharts({ charts }: ReviewChartsProps) {
  if (!charts || charts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {charts.map((chart, index) => {
        switch (chart.type) {
          case "bar":
            return <BarChartItem key={index} chart={chart} />;
          case "line":
            return <LineChartItem key={index} chart={chart} />;
          case "pie":
            return <PieChartItem key={index} chart={chart} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
