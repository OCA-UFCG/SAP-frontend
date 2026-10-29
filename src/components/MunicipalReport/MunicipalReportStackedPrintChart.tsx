import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import {
  buildStackedChartData,
  MUNICIPAL_REPORT_STACKED_MAX_COLUMNS,
} from "@/utils/municipalReportStackedChart";

const WIDTH = 640;
const PLOT_LEFT = 44;
const PLOT_RIGHT = 12;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 254;
const LEGEND_ROW_HEIGHT = 16;
const FONT_SIZE = 9.5;
/** Largura média de um caractere a 9,5 px, para diagramar sem medir o texto. */
const CHAR_WIDTH = 5.4;

const PLOT_WIDTH = WIDTH - PLOT_LEFT - PLOT_RIGHT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const Y_TICKS = [0, 20, 40, 60, 80, 100];

/**
 * A legenda em linhas que quebram pela largura de cada rótulo. Numa grade fixa
 * de 4 colunas, "Recuperação parcial da umidade" passava por cima do vizinho.
 */
function layoutLegend(labels: readonly string[], top: number) {
  let x = PLOT_LEFT;
  let row = 0;
  return labels.map((label) => {
    const width = 14 + label.length * CHAR_WIDTH + 18;
    if (x > PLOT_LEFT && x + width > WIDTH - PLOT_RIGHT) {
      x = PLOT_LEFT;
      row += 1;
    }
    const position = { x, y: top + row * LEGEND_ROW_HEIGHT };
    x += width;
    return position;
  });
}

export function MunicipalReportStackedPrintChart({
  analysis,
  referencePeriod,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  referencePeriod: string | null;
  translateLabel: (label: string) => string;
}) {
  const data = buildStackedChartData(
    analysis,
    referencePeriod,
    MUNICIPAL_REPORT_STACKED_MAX_COLUMNS,
  );
  if (data.rows.length === 0 || data.series.length === 0) return null;

  const columnCount = data.rows.length;
  const slotWidth = PLOT_WIDTH / columnCount;
  const barWidth = slotWidth * 0.62;
  // Datas que não cabem embaixo da própria coluna (os decêndios do CDI, com
  // 12 colunas) saem inclinadas, em vez de encostarem umas nas outras.
  const labels = data.rows.map((row) =>
    row.highlighted ? `${row.period}*` : row.period,
  );
  const longestLabel = Math.max(...labels.map((label) => label.length));
  const tiltLabels = longestLabel * CHAR_WIDTH > slotWidth - 4;
  const legendTop =
    PLOT_BOTTOM + (tiltLabels ? longestLabel * CHAR_WIDTH * 0.71 + 24 : 34);
  const legendLabels = data.series.map((series) =>
    translateLabel(series.label),
  );
  const legend = layoutLegend(legendLabels, legendTop);
  const chartHeight = (legend.at(-1)?.y ?? legendTop) + 12;

  return (
    <svg
      className="report-print-chart-svg block h-auto w-full"
      viewBox={`0 0 ${WIDTH} ${chartHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${analysis.title}: ${data.firstPeriod} a ${data.lastPeriod}`}
    >
      {Y_TICKS.map((tick) => {
        const y = PLOT_BOTTOM - (tick / 100) * PLOT_HEIGHT;

        return (
          <g key={tick}>
            <line
              x1={PLOT_LEFT}
              x2={WIDTH - PLOT_RIGHT}
              y1={y}
              y2={y}
              stroke="#E4EBE5"
              strokeWidth="1"
            />
            <text
              x={PLOT_LEFT - 8}
              y={y + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="#58655C"
            >
              {tick}%
            </text>
          </g>
        );
      })}

      {data.rows.map((row, columnIndex) => {
        const x =
          PLOT_LEFT + columnIndex * slotWidth + (slotWidth - barWidth) / 2;
        let cursor = PLOT_BOTTOM;

        return (
          <g key={row.period}>
            {data.series.map((series) => {
              const share = row.shares[series.id] ?? 0;
              if (share <= 0) return null;
              const height = (share / 100) * PLOT_HEIGHT;
              cursor -= height;

              return (
                <rect
                  key={series.id}
                  data-stack-segment={`${row.period}:${series.id}`}
                  x={x}
                  y={cursor}
                  width={barWidth}
                  height={height}
                  fill={series.color}
                  stroke="#00000022"
                  strokeWidth="0.5"
                />
              );
            })}
            {tiltLabels ? (
              <text
                x={x + barWidth / 2}
                y={PLOT_BOTTOM + 12}
                textAnchor="end"
                fontSize={FONT_SIZE}
                fill="#58655C"
                transform={`rotate(-45 ${x + barWidth / 2} ${PLOT_BOTTOM + 12})`}
              >
                {labels[columnIndex]}
              </text>
            ) : (
              <text
                x={x + barWidth / 2}
                y={PLOT_BOTTOM + 16}
                textAnchor="middle"
                fontSize={FONT_SIZE}
                fill="#58655C"
              >
                {labels[columnIndex]}
              </text>
            )}
          </g>
        );
      })}

      <line
        x1={PLOT_LEFT}
        x2={WIDTH - PLOT_RIGHT}
        y1={PLOT_BOTTOM}
        y2={PLOT_BOTTOM}
        stroke="#D3DCD5"
        strokeWidth="1"
      />

      {data.series.map((series, index) => {
        const { x, y } = legend[index];

        return (
          <g key={series.id}>
            <rect
              x={x}
              y={y - 7}
              width={9}
              height={9}
              rx="2"
              fill={series.color}
              stroke="#00000022"
              strokeWidth="0.5"
            />
            <text x={x + 14} y={y} fontSize={FONT_SIZE} fill="#2C3A31">
              {legendLabels[index]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
