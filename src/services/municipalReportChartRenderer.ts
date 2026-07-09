import "server-only";

import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import { buildMunicipalReportChartData } from "@/utils/municipalReportChart";

interface RenderMunicipalReportChartOptions {
  highlightPeriod: string;
}

const WIDTH = 960;
const HEIGHT = 540;
const PADDING_LEFT = 76;
const PADDING_RIGHT = 48;
const CHART_TOP = 128;
const CHART_BOTTOM = 384;
const CHART_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const MARKER_LIMIT = 36;

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatReferencePeriod(value: string | null) {
  return value ?? "periodo indisponivel";
}

function xForIndex(index: number, count: number) {
  if (count <= 1) return PADDING_LEFT + CHART_WIDTH / 2;
  return PADDING_LEFT + (index / (count - 1)) * CHART_WIDTH;
}

function yForValue(value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  return CHART_BOTTOM - (clamped / 100) * (CHART_BOTTOM - CHART_TOP);
}

function buildPolyline(points: Array<{ value: number }>) {
  return points
    .map((point, index) => {
      const x = xForIndex(index, points.length);
      const y = yForValue(point.value);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function shouldShowMarker(index: number, count: number, highlighted: boolean) {
  if (highlighted) return true;
  if (count <= MARKER_LIMIT) return true;
  return index === 0 || index === count - 1;
}

export async function renderMunicipalReportChart(
  analysis: MunicipalReportAnalysis,
  { highlightPeriod }: RenderMunicipalReportChartOptions,
) {
  const chartData = buildMunicipalReportChartData(analysis, highlightPeriod);
  const categoryCount = Math.max(chartData.categories.length, 1);
  const highlightedIndex = chartData.categories.findIndex(
    (category) => category.highlighted,
  );
  const highlightedX =
    highlightedIndex >= 0 ? xForIndex(highlightedIndex, categoryCount) : null;

  const gridLines = [0, 20, 40, 60, 80, 100]
    .map((value) => {
      const y = yForValue(value);
      return `
        <line x1="${PADDING_LEFT}" y1="${y.toFixed(1)}" x2="${WIDTH - PADDING_RIGHT}" y2="${y.toFixed(1)}" stroke="#D8D9D4" stroke-width="1" opacity="${value === 0 ? "1" : "0.7"}" />
        <text x="${PADDING_LEFT - 14}" y="${(y + 5).toFixed(1)}" text-anchor="end" font-family="Arial, sans-serif" font-size="15" fill="#6B6768">${value}%</text>
      `;
    })
    .join("");

  const lines = chartData.series
    .map((series) => {
      const polyline = buildPolyline(series.points);
      const markers = series.points
        .map((point, index) => {
          if (
            !shouldShowMarker(index, series.points.length, point.highlighted)
          ) {
            return "";
          }

          const x = xForIndex(index, series.points.length);
          const y = yForValue(point.value);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${point.highlighted ? "4.5" : "2.4"}" fill="#FFFFFF" stroke="${series.color}" stroke-width="${point.highlighted ? "3" : "2"}" />`;
        })
        .join("");

      return `
        <polyline points="${polyline}" fill="none" stroke="${series.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ${markers}
      `;
    })
    .join("");

  const visibleLabels = chartData.categories
    .filter(
      (category, index) =>
        index === 0 ||
        index === chartData.categories.length - 1 ||
        category.highlighted,
    )
    .map((category, labelIndex, visibleCategories) => {
      const sourceIndex = chartData.categories.indexOf(category);
      const x = xForIndex(sourceIndex, categoryCount);
      const anchor =
        labelIndex === 0
          ? "start"
          : labelIndex === visibleCategories.length - 1
            ? "end"
            : "middle";
      const weight = category.highlighted ? "700" : "400";
      return `<text x="${x.toFixed(1)}" y="424" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="16" font-weight="${weight}" fill="#6B6768">${escapeSvgText(category.label)}</text>`;
    })
    .join("");

  const legend = chartData.series
    .map((series, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 76 + column * 420;
      const y = 468 + row * 28;
      return `
        <circle cx="${x}" cy="${y - 5}" r="5" fill="${series.color}" />
        <text x="${x + 14}" y="${y}" font-family="Arial, sans-serif" font-size="16" fill="#292829">${escapeSvgText(series.label)}</text>
      `;
    })
    .join("");

  const highlightedRule =
    highlightedX == null
      ? ""
      : `<line x1="${highlightedX.toFixed(1)}" y1="${CHART_TOP}" x2="${highlightedX.toFixed(1)}" y2="${CHART_BOTTOM}" stroke="#292829" stroke-width="2" stroke-dasharray="6 6" opacity="0.42" />`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="100%" height="100%" fill="#FFFFFF" />
    <text x="72" y="58" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#292829">${escapeSvgText(analysis.title)}</text>
    <text x="72" y="94" font-family="Arial, sans-serif" font-size="18" fill="#6B6768">Serie historica completa por classe - referencia: ${escapeSvgText(formatReferencePeriod(chartData.referencePeriod))}</text>
    ${gridLines}
    <line x1="${PADDING_LEFT}" y1="${CHART_TOP}" x2="${PADDING_LEFT}" y2="${CHART_BOTTOM}" stroke="#D8D9D4" stroke-width="2" />
    <line x1="${PADDING_LEFT}" y1="${CHART_BOTTOM}" x2="${WIDTH - PADDING_RIGHT}" y2="${CHART_BOTTOM}" stroke="#D8D9D4" stroke-width="2" />
    ${highlightedRule}
    ${lines}
    ${visibleLabels}
    ${legend}
  </svg>`;

  return Buffer.from(svg);
}
