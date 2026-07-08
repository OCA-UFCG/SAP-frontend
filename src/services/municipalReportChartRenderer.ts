import "server-only";

import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";

interface RenderMunicipalReportChartOptions {
  highlightPeriod: string;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPercentage(value: number) {
  return `${Math.round(value)}%`;
}

export async function renderMunicipalReportChart(
  analysis: MunicipalReportAnalysis,
  { highlightPeriod }: RenderMunicipalReportChartOptions,
) {
  const width = 960;
  const height = 540;
  const paddingX = 72;
  const chartTop = 136;
  const chartBottom = 408;
  const barWidth = 26;
  const snapshots = analysis.timeSeries.slice(-24);
  const maxItems = Math.max(snapshots.length, 1);
  const step = maxItems > 1 ? (width - paddingX * 2) / (maxItems - 1) : 0;

  const bars = snapshots
    .map((snapshot, index) => {
      const dominant = snapshot.dominantClass;
      const percentage = dominant?.percentage ?? 0;
      const barHeight = Math.max(2, (percentage / 100) * (chartBottom - chartTop));
      const x = paddingX + index * step - barWidth / 2;
      const y = chartBottom - barHeight;
      const isHighlighted =
        snapshot.period === highlightPeriod ||
        snapshot.period === analysis.effectivePeriod;

      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth}" height="${barHeight.toFixed(1)}" rx="4" fill="${dominant?.color ?? "#989F43"}" opacity="${isHighlighted ? "1" : "0.72"}" />
        ${
          isHighlighted
            ? `<text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#292829">${formatPercentage(percentage)}</text>`
            : ""
        }
      `;
    })
    .join("");

  const labels = snapshots
    .filter((_, index) => index === 0 || index === snapshots.length - 1)
    .map((snapshot, index, visibleSnapshots) => {
      const sourceIndex = snapshots.indexOf(snapshot);
      const x = paddingX + sourceIndex * step;
      const anchor = index === 0 ? "start" : index === visibleSnapshots.length - 1 ? "end" : "middle";
      return `<text x="${x.toFixed(1)}" y="448" text-anchor="${anchor}" font-family="Arial, sans-serif" font-size="18" fill="#6B6768">${escapeSvgText(snapshot.label)}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#FFFFFF" />
    <text x="72" y="68" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#292829">${escapeSvgText(analysis.title)}</text>
    <text x="72" y="104" font-family="Arial, sans-serif" font-size="18" fill="#6B6768">Periodo de referencia: ${escapeSvgText(analysis.effectivePeriod ?? analysis.requestedPeriod)}</text>
    <line x1="72" y1="${chartBottom}" x2="${width - 72}" y2="${chartBottom}" stroke="#D8D9D4" stroke-width="2" />
    <line x1="72" y1="${chartTop}" x2="72" y2="${chartBottom}" stroke="#D8D9D4" stroke-width="2" />
    ${bars}
    ${labels}
  </svg>`;

  return Buffer.from(svg);
}
