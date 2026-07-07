import "server-only";

import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type {
  MunicipalReportAnalysis,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";

const CHART_WIDTH = 900;
const CHART_HEIGHT = 450;
const BACKGROUND_COLOR = "#ffffff";

const chartCanvas = new ChartJSNodeCanvas({
  width: CHART_WIDTH,
  height: CHART_HEIGHT,
  backgroundColour: BACKGROUND_COLOR,
});

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildDatasets(
  timeSeries: MunicipalReportPeriodSnapshot[],
  analysis: MunicipalReportAnalysis,
) {
  if (timeSeries.length === 0 || analysis.classes.length === 0) return [];

  return analysis.classes.map((cls) => ({
    label: cls.label,
    borderColor: cls.color,
    backgroundColor: hexToRgba(cls.color, 0.08),
    pointBackgroundColor: cls.color,
    pointBorderColor: cls.color,
    pointRadius: 3,
    pointHoverRadius: 5,
    borderWidth: 2,
    tension: 0.3,
    fill: false,
    data: timeSeries.map((snapshot) => {
      const item = snapshot.distribution.find((d) => d.id === cls.id);
      return item?.percentage ?? 0;
    }),
  }));
}

export async function renderMunicipalReportChart(
  analysis: MunicipalReportAnalysis,
  options?: { highlightPeriod?: string },
): Promise<Buffer> {
  const timeSeries = analysis.timeSeries;
  const labels = timeSeries.map((s) => s.label);
  const datasets = buildDatasets(timeSeries, analysis);


  const buffer = await chartCanvas.renderToBuffer({
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: false,
      layout: {
        padding: { top: 16, right: 24, bottom: 8, left: 16 },
      },
      plugins: {
        title: {
          display: true,
          text: `${analysis.title} — Série Temporal`,
          font: { size: 16, weight: "bold" },
          color: "#292829",
          padding: { bottom: 16 },
        },
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 16,
            font: { size: 11 },
            color: "#555",
          },
        },

      },
      scales: {
        x: {
          grid: { color: "rgba(0, 0, 0, 0.04)" },
          ticks: {
            font: { size: 10 },
            color: "#666",
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            callback: (value: string | number) => `${value}%`,
            font: { size: 11 },
            color: "#666",
          },
          grid: {
            color: (context: { tick: { value: number } }) =>
              context.tick.value % 20 === 0
                ? "rgba(0, 0, 0, 0.08)"
                : "transparent",
          },
        },
      },
    },
  });

  return buffer;
}
